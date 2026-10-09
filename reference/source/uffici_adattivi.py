#!/usr/bin/env python3
"""Modello disaggregato per ufficio: apprendimento su storici, forecast e raggruppamento.

Uso di ricerca/offline; nessuna interfaccia a PLC o controllori di sicurezza.
Le osservazioni sono conteggi per ufficio (non identificativi personali).
"""
from __future__ import annotations
import json, math
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
import numpy as np
from scipy.stats import norm
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt


def resolve_offices(cfg):
    p=cfg.get('offices') or {}
    n_floor=int(cfg['building']['upper_floors'])
    defs=p.get('definitions') or []
    if defs:
        offices=[dict(x) for x in defs]
        if p.get('number_of_offices') is not None and int(p['number_of_offices'])!=len(offices):
            raise ValueError('number_of_offices diverso dalla lunghezza di offices.definitions')
    else:
        n=int(p.get('number_of_offices',n_floor))
        if n<1:raise ValueError('number_of_offices deve essere positivo')
        per_floor=cfg['building'].get('employees_per_floor',35)
        default_total=sum(per_floor) if isinstance(per_floor,list) else n_floor*int(per_floor)
        total=int(p.get('total_employees',default_total))
        focus=p.get('focus_office') or {}
        focus_size=(total if n==1 else int(focus.get('employees',0))) if focus else 0
        if focus_size>=total and n>1:raise ValueError('focus_office.employees >= total_employees')
        sizes=[]
        remaining=total-focus_size
        if remaining < n-(1 if focus else 0):raise ValueError('Piu uffici che addetti disponibili: ridurre number_of_offices o aumentare total_employees')
        base,extra=divmod(remaining,max(1,n-(1 if focus else 0)))
        for i in range(n-(1 if focus else 0)):
            sizes.append(base+(1 if i<extra else 0))
        hrs=p.get('default_lunch_start_hours',cfg['traffic']['lunch_start_hours'])
        offices=[]
        if focus:
            offices.append({'id':str(focus.get('id','U12-FOCUS')),'floor':int(focus.get('floor',min(12,n_floor))),
                            'employees':focus_size,'lunch_start_hour':float(focus.get('lunch_start_hour',13))})
        for i,size in enumerate(sizes):
            floor=(i % n_floor)+1
            # Distribuzione riproducibile tra 12, 13 e 14, inclusa sovrapposizione sullo stesso piano.
            offices.append({'id':f'U{i+1:02d}','floor':floor,'employees':size,
                            'lunch_start_hour':float(hrs[(i*7+floor)%len(hrs)])})
    seed=int(p.get('habit_seed',917));rng=np.random.default_rng(seed)
    for i,o in enumerate(offices):
        o['id']=str(o.get('id',f'U{i+1:02d}'))
        o['floor']=int(o['floor']);o['employees']=int(o['employees'])
        o['lunch_start_hour']=float(o.get('lunch_start_hour',cfg['traffic']['lunch_start_hours'][i%len(cfg['traffic']['lunch_start_hours'])]))
        o['lunch_participation']=float(o.get('lunch_participation', cfg['traffic']['lunch_participation']))
        # Offset segreto al previsore: realizza un'abitudine stabile ma appresa solo dai log.
        o['habit_offset_minutes']=float(o.get('habit_offset_minutes',np.clip(rng.normal(0,p.get('true_habit_sd_minutes',9.0)),-19,19)))
        if not (1<=o['floor']<=n_floor):raise ValueError('Piano ufficio fuori range: '+o['id'])
        if o['employees']<1:raise ValueError('Ufficio senza personale: '+o['id'])
        if not 0<=o['lunch_participation']<=1:raise ValueError('lunch_participation non valida: '+o['id'])
    if len(set(o['id'] for o in offices))!=len(offices):raise ValueError('ID ufficio duplicato')
    if not offices:raise ValueError('Definire almeno un ufficio')
    return offices


def fit_office_habits(cfg, train_days, holdout_days):
    offices=resolve_offices(cfg);p=cfg.get('offices',{}); prior=float(p.get('shrinkage_prior_events',22))
    n_days=len(train_days);sigma_prior=float(cfg['traffic']['lunch_sd_minutes'])/60
    models={};base={};obs=defaultdict(list)
    for day in train_days:
        for r in day:
            if getattr(r,'trip_type',None)=='lunch_exit':
                obs[r.office_id].append(r.born/3600)
    for o in offices:
        key=o['id'];t=np.asarray(obs[key]);scheduled=o['lunch_start_hour'];pop=o['employees']
        prior_p=float(o['lunch_participation'])
        alpha=p.get('participation_prior_worker_days',12)
        phat=(len(t)+alpha*prior_p)/(max(1,pop*n_days)+alpha)
        mu=float((len(t)*np.mean(t)+prior*scheduled)/(len(t)+prior)) if len(t) else float(scheduled)
        if len(t)>2:
            observed_var=float(np.var(t,ddof=1))
            sig=float(np.sqrt((len(t)*observed_var+prior*sigma_prior**2)/(len(t)+prior)))
        else:sig=sigma_prior
        models[key]={'id':key,'floor':o['floor'],'employees':pop,'scheduled_hour':scheduled,
                     'estimated_hour':mu,'estimated_sigma_hours':float(np.clip(sig,4/60,30/60)),
                     'estimated_participation':float(np.clip(phat,0.01,0.99)),
                     'historical_lunch_calls':len(t)}
        base[key]={**models[key],'estimated_hour':scheduled,'estimated_sigma_hours':sigma_prior,
                   'estimated_participation':prior_p}
    edges=np.arange(11.5,15.02,5/60)
    def score(models):
        diffs=[]
        for day in holdout_days:
            for o in offices:
                times=[r.born/3600 for r in day if getattr(r,'office_id',None)==o['id'] and getattr(r,'trip_type',None)=='lunch_exit']
                hist=np.histogram(times,bins=edges)[0]
                expected=office_bin_expectation(models[o['id']],edges)
                diffs.extend(np.abs(hist-expected))
        return float(np.mean(diffs))
    metrics={'train_days':n_days,'holdout_days':len(holdout_days),
             'mae_office_5min_schedule':score(base),'mae_office_5min_learned':score(models)}
    key=str((p.get('focus_office') or {}).get('id','U12-FOCUS'))
    if key not in models:key=max(offices,key=lambda z:z['employees'])['id']
    metrics['focus_office_id']=key
    metrics['focus_true_habit_hour']=next(o for o in offices if o['id']==key)['lunch_start_hour']+next(o for o in offices if o['id']==key)['habit_offset_minutes']/60
    metrics['focus_learned_hour']=models[key]['estimated_hour']
    metrics['focus_scheduled_hour']=models[key]['scheduled_hour']
    return offices,models,base,holdout_days,metrics


def office_bin_expectation(m,edges):
    mu=m['estimated_hour'];sig=m['estimated_sigma_hours']
    return m['employees']*m['estimated_participation']*(norm.cdf((edges[1:]-mu)/sig)-norm.cdf((edges[:-1]-mu)/sig))


def forecast_office(m,t_hour,horizon_minutes=12,lead_minutes=3,returning=False,cfg=None):
    mu=m['estimated_hour']+(cfg['traffic']['lunch_duration_minutes']/60 if returning and cfg is not None else 0)
    x0=(t_hour+lead_minutes/60-mu)/m['estimated_sigma_hours']
    x1=(t_hour+(lead_minutes+horizon_minutes)/60-mu)/m['estimated_sigma_hours']
    return max(0,float(m['employees']*m['estimated_participation']*(norm.cdf(x1)-norm.cdf(x0))))


_FLOOR_DEMAND_CACHE={}
def floor_demand(models,cfg,now_s):
    # Conteggi validi al blocco piu' vicino di 5 min, il controller reale puo'
    # ricalibrare periodicamente. Si evita la valutazione ripetuta delle CDF.
    bin_5min=int(now_s//300)
    key=(id(models),id(cfg),bin_5min)
    if key in _FLOOR_DEMAND_CACHE:return _FLOOR_DEMAND_CACHE[key]
    p=cfg.get('offices',{});hour=(bin_5min*300+150)/3600
    horizon=float(p.get('forecast_horizon_minutes',12));lead=float(p.get('preposition_lead_minutes',3))
    demand=defaultdict(float)
    for m in models.values():
        demand[m['floor']]+=forecast_office(m,hour,horizon,lead,False,cfg)
        demand[0]+=forecast_office(m,hour,horizon,lead,True,cfg)
    output=dict(demand)
    _FLOOR_DEMAND_CACHE[key]=output
    return output


def choose_grouping(cfg,models,now_s,car_states,travel_fn):
    """Ottimizzazione marginale discreta del raggruppamento: valuta cabina+destinazione.
    car_states: [(id,piano),...] SOLO cabine effettivamente inattive.
    Preserva una cabina in riserva; puo' allocare piu' cabine allo stesso piano.
    """
    if not car_states:return {}
    p=cfg.get('offices',{});demand=floor_demand(models,cfg,now_s)
    n=int(cfg['building']['upper_floors']);num=int(cfg['building']['number_of_elevators'])
    protect=int(p.get('reserve_idle_cars',1))
    slots=max(0,min(len(car_states),num-protect))
    cap=float(min(cfg['elevators']['max_people'],np.floor(cfg['elevators']['rated_load_kg']*
        cfg['elevators']['optimized_max_planned_load_fraction']/cfg['elevators']['robust_reserved_kg_per_future_passenger'])))
    # Una cabina in 12 minuti puo' servire ~9 richieste prima di un nuovo riposizionamento.
    effective_cap=max(1,cap*float(p.get('effective_capacity_fraction_per_horizon',0.82)))
    min_d=float(p.get('min_office_predicted_calls',3.0)); movement=float(p.get('movement_penalty_per_second',0.10))
    coverage=float(p.get('reserve_coverage_penalty',0.10))
    max_same=int(p.get('max_grouped_cars_per_floor',3))
    assigned={};k=defaultdict(int);free=list(car_states)
    for _ in range(slots):
        best=None
        for cid,current in free:
            for floor,dem in demand.items():
                if floor!=0 and dem<min_d:continue
                if floor==0 and dem<max(min_d,5.):continue
                if k[floor]>=max_same:continue
                # Costi di scopertura decrescono con k, valorizzando i picchi concentrati.
                old=max(0,dem-effective_cap*k[floor])
                new=max(0,dem-effective_cap*(k[floor]+1))
                marginal=30*(old**1.25-new**1.25)/max(1,dem**0.25)
                cost=movement*travel_fn(current,floor,cfg)+coverage*abs(current-floor)
                value=marginal-cost
                if best is None or value>best[0]:best=(value,cid,floor)
        if best is None or best[0]<=0:break
        _,cid,f=best;assigned[cid]=int(f);k[f]+=1;free=[z for z in free if z[0]!=cid]
    # Altre cabine mantengono il parcheggio zonale: garantisce presidio diffuso.
    park=[round(z*n/max(1,num-1)) for z in range(num)]
    for cid,cur in free:assigned[cid]=int(park[cid%num])
    return assigned


def save_office_outputs(cfg,offices,models,baseline,heldout,stats,out,travel_fn):
    out=Path(out);out.mkdir(parents=True,exist_ok=True)
    with (out/'modello_uffici_appreso.json').open('w',encoding='utf8') as f:
        json.dump({'note':'Parametri appresi esclusivamente da giorni training sintetici. Non contiene identificativi individuali.',
                   'metrics':stats,'offices':offices,'models':list(models.values())},f,ensure_ascii=False,indent=2)
    key=stats['focus_office_id'];m=models[key];prev=baseline[key]
    style={'font.family':'DejaVu Sans','font.size':9,'figure.facecolor':'white','savefig.facecolor':'white',
           'axes.facecolor':'white','axes.grid':True,'grid.color':'0.83','grid.linewidth':0.5}
    plt.rcParams.update(style)
    ed=np.arange(12,14.5+0.001,5/60);x=(ed[1:]+ed[:-1])/2
    hist=np.mean([np.histogram([r.born/3600 for r in day if getattr(r,'office_id',None)==key and getattr(r,'trip_type',None)=='lunch_exit'],bins=ed)[0] for day in heldout],axis=0)
    # media holdout per giorno a pari scala
    fig,ax=plt.subplots(figsize=(9.3,3.55))
    ax.bar(x,hist,width=4.3/60,color='.83',edgecolor='.55',lw=0.35,label='Richieste reali giornate test (sintetiche)')
    ax.plot(x,office_bin_expectation(prev,ed),color='.50',lw=1.8,ls='--',label='Previsione su orario dichiarato')
    ax.plot(x,office_bin_expectation(m,ed),color='black',lw=2.2,label='Fit appreso da storico')
    ax.set(ylabel='Richieste / 5 min / giorno',xlabel='Ora',title=f"Apprendimento orario: {key} (piano {m['floor']}, {m['employees']} addetti)")
    ax.set_xlim(min(x),max(x));ax.legend(loc='upper right',fontsize=8,frameon=False)
    fig.tight_layout();fig.savefig(out/'grafico_06_fit_abitudini_ufficio.pdf',bbox_inches='tight');plt.close(fig)
    # heatmap office demand + grouping 4 idle cars computed from EXACT production choice_grouping
    times=np.arange(11.5,14.751,5/60);H=np.zeros((len(offices),len(times)));G=np.zeros_like(H)
    def fake_cars():
        nn=cfg['building']['number_of_elevators'];nf=cfg['building']['upper_floors']
        return [(i,round(i*nf/max(1,nn-1))) for i in range(nn)]
    keys=[o['id'] for o in offices]
    for it,hour in enumerate(times):
        choices=choose_grouping(cfg,models,hour*3600,fake_cars(),travel_fn)
        dest_counts=defaultdict(int)
        for f in choices.values():dest_counts[f]+=1
        for io,office in enumerate(offices):
            H[io,it]=forecast_office(models[office['id']],hour,
                cfg['offices'].get('forecast_horizon_minutes',12),cfg['offices'].get('preposition_lead_minutes',3),False,cfg)
            if office['floor']>0:
                all_at_floor=[j for j,o in enumerate(offices) if o['floor']==office['floor']]
                denom=sum(H[j,it] for j in all_at_floor)
                # attribuzione informativa, non delle cabine fisiche a ciascun singolo ufficio.
                G[io,it]=dest_counts.get(office['floor'],0)*(H[io,it]/denom if denom else 0)
    # ordinate per picco e localita: disegno primi 12 leggibili, ma calcolo tutti N offices
    inds=np.argsort(np.max(H,axis=1))[::-1][:min(12,len(offices))]
    fig,(a,b)=plt.subplots(2,1,figsize=(9.3,5.9),sharex=True,gridspec_kw={'height_ratios':[1.08,1]})
    im=a.imshow(H[inds],aspect='auto',cmap='Greys',interpolation='nearest',extent=[times[0],times[-1],len(inds)-.5,-.5],vmin=0)
    a.set_yticks(range(len(inds)));a.set_yticklabels([f"{offices[i]['id']} (P{offices[i]['floor']})" for i in inds],fontsize=7)
    a.set(title='Domanda appresa per ufficio: passeggeri attesi nei prossimi 12 min',ylabel='Uffici con domanda piu alta')
    fig.colorbar(im,ax=a,label='Richieste previste',fraction=0.025,pad=.02)
    # Aggregated integer grouping per focus floor and a few top floor destinations
    focus=m['floor'];labs=[focus];peaks=[]
    for floor in range(1,cfg['building']['upper_floors']+1):
        if floor==focus:continue
        vals=[sum(H[j,it] for j,o in enumerate(offices) if o['floor']==floor) for it in range(len(times))]
        peaks.append((max(vals),floor))
    labs += [z for _,z in sorted(peaks,reverse=True)[:2]]
    stylecols=['black','.48','.72'];styles=['-','--',':']
    for j,f in enumerate(labs):
        y=[]
        for hour in times:
            group=choose_grouping(cfg,models,hour*3600,fake_cars(),travel_fn)
            y.append(sum(t==f for t in group.values()))
        b.step(times,y,where='mid',lw=2 if j==0 else 1.75,color=stylecols[j],ls=styles[j],label=f'Cabine preposizionate P{f}')
    b.set(xlabel='Ora',ylabel='Numero cabine assegnate',ylim=(-.15,cfg['building']['number_of_elevators']+.15),
          title='Raggruppamento risultante (4 cabine inizialmente disponibili)')
    b.set_yticks(range(cfg['building']['number_of_elevators']+1));b.legend(frameon=False,loc='upper right',fontsize=8)
    fig.tight_layout();fig.savefig(out/'grafico_07_raggruppamento_uffici.pdf',bbox_inches='tight');plt.close(fig)
    stats['max_predicted_grouped_focus']=max(sum(t==focus for t in choose_grouping(cfg,models,h*3600,fake_cars(),travel_fn).values()) for h in times)
    stats['office_count']=len(offices);stats['total_employees']=sum(o['employees'] for o in offices)
    stats['focus_floor']=focus
    return stats

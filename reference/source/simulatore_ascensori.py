#!/usr/bin/env python3
"""Simulatore a eventi discreti, parametrico, riproducibile.
Esempio: python simulatore_ascensori.py --config parametri_ascensori.json --out ./risultati
Dipendenze: numpy, scipy, matplotlib. La creazione del PDF viene gestita separatamente.
Modello di ricerca NON destinato al controllo diretto di ascensori reali.
Assume terminali di chiamata con destinazione selezionata (DCS) in ENTRAMBE le politiche.
"""
import argparse
import copy
import csv
import heapq
import json
import math
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
from scipy.optimize import nnls
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from uffici_adattivi import resolve_offices, fit_office_habits, save_office_outputs, choose_grouping

@dataclass
class Request:
    id:int
    born:float
    source:int
    dest:int
    weight:float
    state:str='WAIT'
    pickup:float|None=None
    finish:float|None=None
    assigned:int|None=None
    retry:int=0
    office_id:str|None=None
    trip_type:str='other'

@dataclass
class Car:
    id:int
    floor:int=0
    plan:list=field(default_factory=list)
    mode:str='idle'
    onboard:set=field(default_factory=set)
    actual_weight:float=0.0
    next_floor:int|None=None
    last_idle:float=0
    distance_floors:float=0.0
    door_stops:int=0
    bypass:int=0
    reposition_floors:float=0.0
    event_version:int=0


def clock(v): return float(v)*3600.0


def make_requests(cfg,seed):
    """Domanda per N uffici, non solo per piano, con abitudini latenti stabili.
    I tag per ufficio simulano conteggi aggregati osservabili solo con autorizzazione.
    """
    rng=np.random.default_rng(seed)
    bd=cfg['building']; tr=cfg['traffic']; ep=cfg['elevators']
    n=bd['upper_floors']
    offices=resolve_offices(cfg)
    req=[]
    def add(t,o,d,office_id,trip_type):
        t=max(clock(tr['simulation_start_hour'])+1,min(clock(tr['simulation_end_hour'])-1,t))
        w=float(np.clip(rng.normal(ep['weight_mean_kg'],ep['weight_sd_kg']),ep['weight_min_kg'],ep['weight_max_kg']))
        req.append(Request(len(req),t,int(o),int(d),w,office_id=office_id,trip_type=trip_type))
    for office in offices:
      floor=int(office['floor']);pop=int(office['employees'])
      daily_shift=rng.normal(0, cfg.get('offices',{}).get('daily_schedule_jitter_minutes',2.5))*60
      lunch_center=clock(office['lunch_start_hour'])+office['habit_offset_minutes']*60+daily_shift
      for worker in range(pop):
        t=rng.normal(clock(tr['arrival_mean_hour']),tr['arrival_sd_minutes']*60)
        add(t,0,floor,office['id'],'arrival')
        t=rng.normal(clock(tr['departure_mean_hour']),tr['departure_sd_minutes']*60)
        add(t,floor,0,office['id'],'departure')
        if rng.random()<office['lunch_participation']:
            t=rng.normal(lunch_center,tr['lunch_sd_minutes']*60)
            add(t,floor,0,office['id'],'lunch_exit')
            add(t+tr['lunch_duration_minutes']*60,0,floor,office['id'],'lunch_return')
        if rng.random()<tr['internal_trips_probability_per_worker']:
            dst=int(rng.integers(1,n+1))
            if dst==floor: dst=(floor%n)+1
            t=rng.uniform(clock(9),clock(18))
            add(t,floor,dst,office['id'],'internal')
    req.sort(key=lambda a:a.born)
    for i,r in enumerate(req):r.id=i
    return req


def travel_seconds(a,b, cfg):
    ep=cfg['elevators']; d=abs(a-b)*cfg['building']['floor_height_m']; v=ep['speed_m_s']; ac=ep['acceleration_m_s2']
    if d<=0:return 0.0
    if d<=v*v/ac:return 2*math.sqrt(d/ac)
    return d/v+v/ac


def future_profile(car,plan,requests,cfg):
    """Ritorna istanti di pickup/drop, verifica capienza solo per la fase pianificata.
    Gli occupanti reali dell'auto hanno peso misurato, gli attesi sono riservati.
    """
    ep=cfg['elevators']; tm=0.0; fl=car.next_floor if car.mode=='moving' else car.floor
    if car.mode=='moving': tm=0.0  # residuo impostato separatamente nel valutatore
    load=car.actual_weight; ppl=len(car.onboard)
    pick={}; done={}; feasible=True
    for kind,rid in plan:
        r=requests[rid] if rid>=0 else None
        target=r.source if kind=='P' else (r.dest if kind=='D' else rid*-1-1)
        tm+=travel_seconds(fl,target,cfg)
        fl=target
        if kind=='P':
            reserve=float(ep['robust_reserved_kg_per_future_passenger'])
            load+=reserve;ppl+=1;pick[rid]=tm
            if load>ep['rated_load_kg']*ep['optimized_max_planned_load_fraction'] or ppl>ep['max_people']:feasible=False
        elif kind=='D':
            # Se presente a bordo, il suo peso e' noto; altrimenti lo si riserva.
            reserve=r.weight if r.state=='ONBOARD' else float(ep['robust_reserved_kg_per_future_passenger'])
            load-=reserve;ppl-=1; done[rid]=tm
        tm+=ep['door_base_s']+ep['passenger_transfer_s']
    return pick,done,tm,feasible


def current_route_expected(car,requests,cfg,now):
    """ETA dei task; car.mode moving: il primo target non puo' cambiare.
    Conservativamente si assume il tempo di percorso completo per il primo segmento.
    """
    ep=cfg['elevators']; t=now; fl=car.floor
    if car.mode=='moving':
        # posizione nominale al piano di partenza, conservativo; l'evento effettivo rimane schedulato.
        t+=0.5*travel_seconds(fl,car.next_floor,cfg)
        fl=car.next_floor
    elif car.mode=='dwelling': t+=ep['door_base_s']
    load=car.actual_weight;count=len(car.onboard)
    pk={}; dr={}; capacity=True
    for j,(kind,rid) in enumerate(car.plan):
        r=requests[rid] if rid>=0 else None
        f=r.source if kind=='P' else (r.dest if kind=='D' else (-rid-1))
        if j==0 and car.mode=='moving':
            # La durata del segmento gia' in corso e' contabilizzata sopra.
            pass
        else:t+=travel_seconds(fl,f,cfg)
        fl=f
        if kind=='P':
            pk[rid]=t
            load+=ep['robust_reserved_kg_per_future_passenger'];count+=1
            if load>ep['rated_load_kg']*ep['optimized_max_planned_load_fraction'] or count>ep['max_people']:capacity=False
        elif kind=='D':
            dr[rid]=t
            load-=(r.weight if r.state=='ONBOARD' else ep['robust_reserved_kg_per_future_passenger']);count-=1
        t+=ep['door_base_s']+ep['passenger_transfer_s']
    return pk,dr,t,capacity


def scoring(car,plan,reqs,cfg,now):
    # scoratura del totale attesa/running solo delle chiamate effettive, con penalita' di attesa lunga.
    fake=copy.copy(car);fake.plan=plan
    picks,drops,_,feasible=current_route_expected(fake,reqs,cfg,now)
    if not feasible:return math.inf
    et=cfg['experiment']; val=0
    # Evita sommare il pregresso: e' costante fra i candidati.
    for rid,tm in picks.items():
        r=reqs[rid]
        if r.state!='WAIT': continue
        w=max(0.,tm-now)
        val+=w + et['objective_late_wait_factor']*max(0, (tm-r.born)-et['fairness_threshold_seconds'])**2/100.
    for rid,tm in drops.items():
        r=reqs[rid]
        if r.state=='WAIT' and rid in picks: ride=max(0,tm-picks[rid])
        elif r.state=='ONBOARD':ride=max(0,tm-now)
        else:continue
        val+=et['objective_ride_time_factor']*ride
    # E' un criterio aggregato parziale: per comparare auto diverse, delta rispetto al piano corrente.
    return val


def try_assign(r, cars,reqs, cfg, now,policy):
    ep=cfg['elevators']
    if policy=='fifo':
        # Benchmark REATTIVO: serve la chiamata con ETA minimo, senza previsione oraria,
        # ma protegge con penalita' moderata i passeggeri gia' prenotati. Entrambe le
        # politiche fanno inserimento di fermate, non un FIFO irrealistico di viaggi interi.
        options=[]
        for c in cars:
            if len(c.plan)>=28:continue
            prior_pick,_,_,_=current_route_expected(c,reqs,cfg,now)
            start=1 if c.mode=='moving' and c.plan else 0
            for i in range(start,len(c.plan)+1):
                for j in range(i+1,len(c.plan)+2):
                    plan=c.plan[:i]+[('P',r.id)]+c.plan[i:j-1]+[('D',r.id)]+c.plan[j-1:]
                    fake=copy.copy(c);fake.plan=plan
                    after_pick,after_drop,_,feasible=current_route_expected(fake,reqs,cfg,now)
                    if not feasible:continue
                    eta=after_pick[r.id]-now
                    ride=after_drop[r.id]-after_pick[r.id]
                    disruption=sum(max(0,after_pick.get(k,now)-pt) for k,pt in prior_pick.items())
                    score=eta+0.28*ride+0.32*disruption
                    options.append((score,c.id,plan))
        if not options:return False
        _,cid,plan=min(options,key=lambda z:(z[0],z[1]));cars[cid].plan=plan;r.assigned=cid
        return True
    # Ottimizzato: minimizza costo marginale di inserimento di due fermate, con vincolo di peso.
    cand=[]
    for c in cars:
        if len(c.plan)>=28:continue
        before=scoring(c,c.plan,reqs,cfg,now)
        if not math.isfinite(before):
            before=1e7
        start=1 if c.mode=='moving' and len(c.plan)>0 else 0
        # Candidate fast routing: consecutive pick/drop or any insertion pair (limited lookahead).
        for i in range(start,len(c.plan)+1):
            for j in range(i+1,len(c.plan)+2):
                plan=c.plan[:i]+[('P',r.id)]+c.plan[i:j-1]+[('D',r.id)]+c.plan[j-1:]
                score=scoring(c,plan,reqs,cfg,now)
                if not math.isfinite(score):continue
                # Piccolo premio per prevedibilita' e per regolarizzazione movimenti.
                delta=score-before
                if c.mode=='idle' and not c.plan:delta+=0.001*abs(c.floor-r.source)
                cand.append((delta,score,c.id,plan))
    if not cand:return False
    _,_,cid,route=min(cand,key=lambda k:(k[0],k[1],k[2]))
    c=cars[cid];c.plan=route;r.assigned=cid
    return True


def simulation(cfg,seed,policy,office_model=None):
    requests=make_requests(cfg,seed); cars=[Car(i) for i in range(cfg['building']['number_of_elevators'])]
    events=[];count=0;now=0.;blocked=[]
    for r in requests:
        heapq.heappush(events,(r.born,count,'NEW',(r.id,)));count+=1
    def push(t,name,data):
        nonlocal count
        heapq.heappush(events,(t,count,name,data));count+=1
    def schedule(c,t):
        if c.mode!='idle' or not c.plan:return
        kind,rid=c.plan[0]
        f=requests[rid].source if kind=='P' else (requests[rid].dest if kind=='D' else (-rid-1))
        c.next_floor=f; c.mode='moving'
        push(t+travel_seconds(c.floor,f,cfg),'ARRIVE',(c.id,c.event_version))
    def retry_all(t):
        nonlocal blocked
        if not blocked:return
        left=[]
        for rid in blocked:
            r=requests[rid]
            if r.state!='WAIT':continue
            if not try_assign(r,cars,requests,cfg,t,policy):left.append(rid)
        blocked=left
        for c in cars:schedule(c,t)
    reloc_idle_at={}
    group_max_by_floor=defaultdict(int)
    adaptive_plans=0
    while events:
        now,_,event,args=heapq.heappop(events)
        if now>clock(cfg['traffic']['simulation_end_hour']):break
        if event=='NEW':
            r=requests[args[0]]
            if not try_assign(r,cars,requests,cfg,now,policy):blocked.append(r.id)
            for c in cars:schedule(c,now)
        elif event=='ARRIVE':
            cid,version=args;c=cars[cid]
            if c.mode!='moving' or version!=c.event_version:continue
            current_floor=c.next_floor
            if current_floor!=c.floor:
                c.distance_floors+=abs(current_floor-c.floor)
                if c.plan and c.plan[0][0]=='R':c.reposition_floors+=abs(current_floor-c.floor)
            c.floor=current_floor;c.next_floor=None
            n_transfer=0;had_stop=False
            # Le uscite hanno priorita', anche se pieno. Stesse destinazioni sulla stessa fermata.
            while c.plan and ( (requests[c.plan[0][1]].source if c.plan[0][0]=='P' else requests[c.plan[0][1]].dest if c.plan[0][0]=='D' else (-c.plan[0][1]-1)) == c.floor):
                kind,rid=c.plan.pop(0)
                if kind=='R':continue
                r=requests[rid]
                if kind=='D':
                    if r.state=='ONBOARD':
                        r.finish=now;r.state='DONE';c.onboard.discard(rid);c.actual_weight-=r.weight
                        n_transfer+=1;had_stop=True
                elif kind=='P' and r.state=='WAIT':
                    if c.actual_weight+r.weight <=cfg['elevators']['rated_load_kg'] and len(c.onboard)<cfg['elevators']['max_people']:
                        r.state='ONBOARD';r.pickup=now;c.onboard.add(rid);c.actual_weight+=r.weight
                        n_transfer+=1;had_stop=True
                    else:
                        # Salta la fermata se non e' necessaria un'altra operazione; incarica altra cabina.
                        c.bypass+=1;r.retry+=1;r.assigned=None
                        c.plan=[z for z in c.plan if z!=('D',rid)]
                        blocked.append(rid)
            if had_stop:
                c.door_stops+=1;c.mode='dwelling'
                push(now+cfg['elevators']['door_base_s']+cfg['elevators']['passenger_transfer_s']*n_transfer,'DOOR',(cid,))
            else:
                c.mode='idle';c.last_idle=now;schedule(c,now)
            retry_all(now)
        elif event=='DOOR':
            c=cars[args[0]]
            c.mode='idle'; c.last_idle=now
            schedule(c,now)
            retry_all(now)
        # Repositioning forecast controlled when truly idle and no pending assignments.
        if policy in ('optimal','adaptive') and event in ('NEW','ARRIVE','DOOR'):
            for c in cars:
                if c.mode=='idle' and not c.plan and not blocked:
                    epoch=round(now,2)
                    if reloc_idle_at.get(c.id)!=epoch:
                        reloc_idle_at[c.id]=epoch
                        push(now+cfg['experiment']['relocation_idle_delay_seconds'],'PARK',(c.id,epoch))
        if event=='PARK' and policy=='adaptive' and office_model is not None:
            cid,epoch=args;c=cars[cid]
            if c.mode=='idle' and not c.plan and reloc_idle_at.get(cid)==epoch and not blocked:
                idle=[(i.id,i.floor) for i in cars if i.mode=='idle' and not i.plan]
                targets=choose_grouping(cfg,office_model,now,idle,travel_seconds)
                counts=defaultdict(int)
                for target in targets.values():counts[target]+=1
                for floor,num in counts.items():
                    if floor>0:group_max_by_floor[floor]=max(group_max_by_floor[floor],num)
                adaptive_plans+=1
                for c2 in cars:
                    if c2.id in targets and c2.mode=='idle' and not c2.plan and c2.floor!=targets[c2.id]:
                        f=targets[c2.id];c2.plan=[('R',-f-1)];schedule(c2,now)
        if event=='PARK' and policy=='optimal':
            cid,epoch=args;c=cars[cid]
            if c.mode=='idle' and not c.plan and reloc_idle_at.get(cid)==epoch:
                # circa 12 minuti: tendenza deterministica basata sugli orari delle 3 pause.
                tr=cfg['traffic'];hour=now/3600
                midday=any(abs(hour - x)<0.27 or abs(hour-(x+1))<0.27 for x in tr['lunch_start_hours'])
                target=0 if (hour<9.0 or 12.6<hour<15.35 or hour<11.7 or hour>19.5) else None
                park_targets=[round(z*cfg['building']['upper_floors']/max(1,len(cars)-1)) for z in range(len(cars))]
                if 18.55<hour<19.55 or (midday and any(abs(hour-x)<0.27 for x in tr['lunch_start_hours'])):
                    # Ripartizione per livelli estesa anche a numeri diversi di cabine/piani.
                    target=park_targets[cid]
                elif target is None:
                    target=park_targets[cid]
                if c.floor!=target:
                    c.plan=[('R',-target-1)];schedule(c,now)
    valid=[r for r in requests if r.pickup is not None and r.finish is not None]
    waits=np.array([r.pickup-r.born for r in valid])
    rides=np.array([r.finish-r.pickup for r in valid])
    all_count=len(requests);served=len(valid)
    if served<all_count:
        print(f'ATTENZIONE: {policy} seed={seed} restano {all_count-served} richieste incomplete prima del limite della simulazione')
    return {
        'policy':policy,'seed':seed,'requests':requests,'cars':cars,
        'count':served,'unserved':all_count-served,'served_pct':100*served/max(1,all_count),'mean_wait':float(np.mean(waits)),'median_wait':float(np.median(waits)),
        'p90_wait':float(np.percentile(waits,90)),'p95_wait':float(np.percentile(waits,95)),
        'wait_over_120_pct':float(100*np.mean(waits>120)),
        'mean_ride':float(np.mean(rides)),'mean_journey':float(np.mean(waits+rides)),
        'bypasses':sum(c.bypass for c in cars),
        'distance_floors':sum(c.distance_floors for c in cars),
        'park_floors':sum(c.reposition_floors for c in cars),
        'door_stops':sum(c.door_stops for c in cars),
        'adaptive_parking_decisions':adaptive_plans,
        'max_grouped_same_floor':max(group_max_by_floor.values(),default=0),
    }


def fitting(arrival_days,cfg):
    tr=cfg['traffic']; ep=cfg['experiment']; width=ep['arrival_histogram_minutes']/60
    edges=np.arange(tr['simulation_start_hour'],tr['simulation_end_hour']+0.0001,width)
    xx=(edges[1:]+edges[:-1])/2
    h=tr['lunch_start_hours']
    centers_up=[tr['arrival_mean_hour']]+[x+tr['lunch_duration_minutes']/60 for x in h]
    centers_dn=list(h)+[tr['departure_mean_hour']]
    sig_up=[tr['arrival_sd_minutes']/60]+[tr['lunch_sd_minutes']/60 for _ in h]
    sig_dn=[tr['lunch_sd_minutes']/60 for _ in h]+[tr['departure_sd_minutes']/60]
    def design(centers,sigs):
        return np.column_stack([np.ones_like(xx)]+[np.exp(-0.5*((xx-mu)/si)**2) for mu,si in zip(centers,sigs)])
    outcomes={}
    for direction,centers,sig in [('up',centers_up,sig_up),('down',centers_dn,sig_dn)]:
        A=design(centers,sig);ys=[]
        for daily in arrival_days:
            tm=np.array([r.born/3600 for r in daily if (r.dest>r.source if direction=='up' else r.dest<r.source)])
            counts,_=np.histogram(tm,bins=edges)
            ys.append(counts/ep['arrival_histogram_minutes']) # pass/minute
        ys=np.asarray(ys)
        n=min(max(1,int(ep['fit_training_days'])),len(ys)-1)
        if n<1:raise ValueError('Servono almeno due semi indipendenti per training/test del fit')
        train=np.mean(ys[:n],axis=0);test=np.mean(ys[n:],axis=0)
        coef,_=nnls(A,train)
        pred=A@coef
        ss=np.sum((test-np.mean(test))**2);r2=1-np.sum((test-pred)**2)/ss
        mae=np.mean(np.abs(test-pred));outcomes[direction]={'x':xx,'train':train,'test':test,'fit':pred,'coef':coef,'r2_test':r2,'mae_test':mae,'centers':centers,'sigmas':sig}
    return outcomes


def style():
    plt.rcParams.update({'font.family':'DejaVu Sans','font.size':9,'axes.labelcolor':'#111111','axes.edgecolor':'#111111','text.color':'#111111','axes.grid':True,'grid.color':'#d0d0d0','grid.linewidth':0.5,'figure.facecolor':'white','axes.facecolor':'white','savefig.facecolor':'white','lines.linewidth':1.6})


def make_charts(results, fits, cfg,out):
    style(); out=Path(out); out.mkdir(parents=True,exist_ok=True)
    # Fits plot: model vs held out binned demand.
    fig,ax=plt.subplots(2,1,figsize=(9.2,5.1),sharex=True)
    for a,(direction,name) in zip(ax,[('up','In salita (destinazione > origine)'),('down','In discesa (destinazione < origine)')]):
        f=fits[direction]
        a.plot(f['x'],f['test'],color='0.65',linewidth=1.15,drawstyle='steps-mid',label='Media giorni test (simulati)')
        a.plot(f['x'],f['fit'],color='black',linewidth=2,label='Best fit NNLS (training)')
        a.set_ylabel('Richieste / min');a.set_title(f"{name} | R² fuori campione = {f['r2_test']:.3f}",loc='left',fontsize=10)
        a.legend(loc='upper right',frameon=False,fontsize=8)
    ax[-1].set_xlim(7,20);ax[-1].set_xticks([7,8,9,10,11,12,13,14,15,16,17,18,19,20]);ax[-1].set_xlabel('Ora del giorno')
    fig.tight_layout();fig.savefig(out/'grafico_01_best_fit_flussi.pdf',bbox_inches='tight');plt.close(fig)
    # Compare per-hour wait, 30m bins, mean from sample.
    step=cfg['experiment']['chart_bin_minutes']/60;edges=np.arange(7,20.5,step);x=(edges[:-1]+edges[1:])/2
    fig,ax=plt.subplots(figsize=(9.2,3.6))
    for policy,col,ls,label in [('fifo','0.70','--','Reattivo'),('optimal','0.43','-.','Ottimizzato per fasce'),('adaptive','black','-','Adattivo per ufficio')]:
        allreq=[r for sim in results[policy] for r in sim['requests']]
        waits=np.asarray([r.pickup-r.born for r in allreq]);t=np.asarray([r.born/3600 for r in allreq])
        mean=np.array([np.mean(waits[(t>=a)&(t<b)]) if np.any((t>=a)&(t<b)) else np.nan for a,b in zip(edges[:-1],edges[1:])]);ax.plot(x,mean,color=col,ls=ls,marker='o',markersize=2.6,label=label)
    ax.set(xlim=(7,20),ylabel='Attesa media (s)',xlabel='Ora di creazione chiamata',title='Attesa per fascia oraria | scenari simulati');ax.legend(frameon=False)
    fig.tight_layout();fig.savefig(out/'grafico_02_attese_orarie.pdf',bbox_inches='tight');plt.close(fig)
    # ECDF wait for each group.
    fig,ax=plt.subplots(figsize=(9.2,3.5))
    for policy,col,ls,label in [('fifo','0.70','--','Reattivo'),('optimal','0.43','-.','Ottimizzato per fasce'),('adaptive','black','-','Adattivo per ufficio')]:
        wt=np.sort(np.array([r.pickup-r.born for sim in results[policy] for r in sim['requests']]))
        ax.plot(wt,np.arange(1,len(wt)+1)/len(wt)*100,color=col,linestyle=ls,label=label)
    ax.set(xlim=(0,500),ylim=(0,100),xlabel='Attesa (secondi)',ylabel='Quota servita entro il tempo (%)',title='Distribuzione cumulata del tempo di attesa')
    ax.legend(frameon=False);fig.tight_layout();fig.savefig(out/'grafico_03_cdf_attese.pdf',bbox_inches='tight');plt.close(fig)
    # Day × policy comparative with uncertainty paired bootstrap style showing seed dots.
    fig,ax=plt.subplots(figsize=(6.6,3.4))
    xx=np.arange(len(results['fifo']))
    for p,col,mark,label in [('fifo','0.70','s','Reattivo'),('optimal','0.45','o','Per fasce'),('adaptive','black','^','Per ufficio')]:
        v=np.array([d['mean_wait'] for d in results[p]])
        ax.plot(xx,v,marker=mark,color=col,ls='--' if p=='fifo' else '-',label=label)
    ax.set(xlabel='Replica Monte Carlo',ylabel='Attesa media giornaliera (s)',title='Robustezza sui medesimi 8 semi',xticks=xx,xticklabels=[str(i+1) for i in xx]);ax.legend(frameon=False)
    fig.tight_layout();fig.savefig(out/'grafico_04_repliche.pdf',bbox_inches='tight');plt.close(fig)
    # Capacita' analitica screening: RTT fissato E' ipotesi, NON un output della simulazione.
    Q=np.arange(550,1551,10); eps=cfg['elevators'];m=cfg['building']['number_of_elevators']; RTT=145.0
    safeN=np.minimum(eps['max_people'],np.floor(eps['optimized_max_planned_load_fraction']*Q/eps['robust_reserved_kg_per_future_passenger']))
    HC=m*300*safeN/RTT
    peaks=[]
    for sim in results['fifo']:
        times=[r.born for r in sim['requests'] if r.source==0 and r.dest>0]
        histogram,_=np.histogram(times,bins=np.arange(7*3600,20*3600+300,300))
        peaks.append(int(max(histogram)))
    fig,ax=plt.subplots(figsize=(8.2,3.5));
    ax.plot(Q,HC,color='black',drawstyle='steps-post',lw=1.9,label='Capacita teorica per 5 min (RTT ipotizzato 145 s)')
    ax.axhline(np.mean(peaks),ls='--',color='.42',lw=1.6,label=f'Picco in salita per 5 min: {np.mean(peaks):.1f} (media 8 repliche)')
    ax.axvline(eps['rated_load_kg'],ls=':',color='.32',lw=1.2,label=f'Portata scelta: {eps["rated_load_kg"]:,.0f} kg')
    ax.set(xlabel='Portata nominale per cabina (kg)',ylabel='Persone trasportabili / 5 min',title='Screening di capacita (non sostituisce simulazione dinamica)')
    ax.set_ylim(bottom=0);ax.legend(frameon=False,fontsize=8,loc='upper left')
    fig.tight_layout();fig.savefig(out/'grafico_05_capacita_kg.pdf',bbox_inches='tight');plt.close(fig)



def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--config',default='parametri_ascensori.json');parser.add_argument('--out',default='risultati_ascensori')
    a=parser.parse_args();cfg=json.loads(Path(a.config).read_text(encoding='utf-8'));out=Path(a.out);out.mkdir(parents=True,exist_ok=True)
    seeds=cfg['experiment']['seeds']; results={}
    office_cfg=cfg.get('offices',{})
    train=[make_requests(cfg,k) for k in office_cfg.get('training_day_seeds',list(range(1101,1113)))]
    holdout=[make_requests(cfg,k) for k in office_cfg.get('validation_day_seeds',[2201,2202,2203,2204])]
    offices,office_model,base_model,holdout,office_stats=fit_office_habits(cfg,train,holdout)
    office_stats=save_office_outputs(cfg,offices,office_model,base_model,holdout,office_stats,out,travel_seconds)
    print('OFFICE LEARNING:', office_stats,flush=True)
    for pol in ['fifo','optimal','adaptive']:
        results[pol]=[]
        for i,seed in enumerate(seeds):
            s=simulation(cfg,seed,pol,office_model if pol=='adaptive' else None);results[pol].append(s)
            print(f"{pol} seed={seed}: wait={s['mean_wait']:.2f}s p95={s['p95_wait']:.2f}s bypass={s['bypasses']} stops={s['door_stops']}",flush=True)
    f=fitting([make_requests(cfg,k) for k in seeds],cfg)
    make_charts(results,f,cfg,out)
    with open(out/'metriche_repliche.csv','w',newline='',encoding='utf-8') as file:
        names=['policy','seed','count','unserved','served_pct','mean_wait','median_wait','p90_wait','p95_wait','wait_over_120_pct','mean_ride','mean_journey','bypasses','distance_floors','park_floors','door_stops','adaptive_parking_decisions','max_grouped_same_floor']
        writer=csv.DictWriter(file,fieldnames=names);writer.writeheader()
        for typ in ['fifo','optimal','adaptive']:
            for s in results[typ]:writer.writerow({k:s[k] for k in names})
    # Paired CI Student t interval for delta / relative improvements.
    from scipy.stats import t as student_t
    summ={}
    for p in results:
        summaries={}
        for key in ['count','unserved','served_pct','mean_wait','median_wait','p90_wait','p95_wait','wait_over_120_pct','mean_ride','mean_journey','bypasses','distance_floors','park_floors','door_stops','adaptive_parking_decisions','max_grouped_same_floor']:
            vals=np.array([z[key] for z in results[p]],float)
            summaries[key]={'mean':float(np.mean(vals)),'std':float(np.std(vals,ddof=1))}
        summ[p]=summaries
    before=np.array([x['mean_wait'] for x in results['fifo']]);after=np.array([x['mean_wait'] for x in results['optimal']]);diff=before-after
    ci=student_t.ppf(0.975,len(diff)-1)*np.std(diff,ddof=1)/np.sqrt(len(diff))
    effect={'paired_wait_reduction_s':float(np.mean(diff)),'paired_ci95_s':[float(np.mean(diff)-ci),float(np.mean(diff)+ci)],'relative_improvement_pct':float(100*(1-np.mean(after)/np.mean(before)))}
    data={'config':cfg,'summary':summ,'effects':effect,'fits':{key:{k:(v.tolist() if isinstance(v,np.ndarray) else v) for k,v in val.items() if k in ('coef','r2_test','mae_test','centers','sigmas')} for key,val in f.items()},'office_learning':office_stats}
    (out/'risultati_sintesi.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
    print('SUMMARY:',json.dumps({'summary':summ,'effects':effect,'fits':data['fits']},ensure_ascii=False,indent=2))

if __name__=='__main__': main()

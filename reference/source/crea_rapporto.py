#!/usr/bin/env python3
"""Rigenera risultati, figure e rapporto PDF.
Requisiti: Python >=3.10, numpy scipy matplotlib e 'lualatex' disponibile.
Esegue la compilazione nella stessa cartella dello script senza dati internet.
"""
import argparse, json, os, subprocess, sys
from pathlib import Path

def fmt(v,d=2):return f'{v:,.{d}f}'.replace(',',' ').replace('.',',')
def cmd(k,v):return '\\newcommand{\\'+k+'}{'+str(v)+'}\n'

def write_macros(config,res,root):
  conf=config; data=res['summary']; effect=res['effects']; fit=res['fits']; lines=[]
  b={k:v['mean'] for k,v in data['fifo'].items()}; o={k:v['mean'] for k,v in data['optimal'].items()}; a={k:v['mean'] for k,v in data['adaptive'].items()}; st=res['office_learning']
  values={
  'Nreq':fmt(b['count'],0),'Nstaff':str(st['total_employees']),
  'Noffices':str(st['office_count']),'Nfocus':str(st['focus_office_id']), 'Nfocusfloor':str(st['focus_floor']),
  'FocusDeclared':fmt(st['focus_scheduled_hour'],3),'FocusLearned':fmt(st['focus_learned_hour'],3),
  'LearnedOfficeMAE':fmt(st['mae_office_5min_learned'],3), 'StaticOfficeMAE':fmt(st['mae_office_5min_schedule'],3),
  'OfficeLearnGain':fmt(100*(1-st['mae_office_5min_learned']/st['mae_office_5min_schedule']),1),
  'MaxPredGroup':str(st['max_predicted_grouped_focus']),
  'Wadapt':fmt(a['mean_wait']), 'PAdapt':fmt(a['p95_wait']),
  'RAdapt':fmt(a['mean_ride']), 'TAdapt':fmt(a['mean_journey']),
  'ParkAdapt':fmt(a['park_floors'],0), 'DistAdapt':fmt(a['distance_floors'],0),
  'BypassAdapt':fmt(a['bypasses'],1),'GroupObserved':fmt(a['max_grouped_same_floor'],2),
  'AdaptivePlans':fmt(a['adaptive_parking_decisions'],1),
  'Nrep':str(len(conf['experiment']['seeds'])),'Qcap':fmt(conf['elevators']['rated_load_kg'],0),'Nplaces':str(conf['elevators']['max_people']),
  'Wreserve':fmt(conf['elevators']['robust_reserved_kg_per_future_passenger'],0),'RhoCap':fmt(conf['elevators']['optimized_max_planned_load_fraction'],2),
  'Wbase':fmt(b['mean_wait']),'Wopt':fmt(o['mean_wait']),
  'MedBase':fmt(b['median_wait']),'MedOpt':fmt(o['median_wait']),
  'PninBase':fmt(b['p90_wait']),'PninOpt':fmt(o['p90_wait']),
  'Pbase':fmt(b['p95_wait']),'Popt':fmt(o['p95_wait']),
  'TailBase':fmt(b['wait_over_120_pct']),'TailOpt':fmt(o['wait_over_120_pct']),
  'Rbase':fmt(b['mean_ride']),'Ropt':fmt(o['mean_ride']),
  'Tbase':fmt(b['mean_journey']),'Topt':fmt(o['mean_journey']),
  'StopBase':fmt(b['door_stops'],0),'StopOpt':fmt(o['door_stops'],0),
  'DistBase':fmt(b['distance_floors'],0),'DistOpt':fmt(o['distance_floors'],0),
  'ParkBase':fmt(b['park_floors'],0),'ParkOpt':fmt(o['park_floors'],0),
  'BypassBase':fmt(b['bypasses'],0),'BypassOpt':fmt(o['bypasses'],0),
  'DiffW':fmt(effect['paired_wait_reduction_s']),'CILow':fmt(effect['paired_ci95_s'][0]),'CIHigh':fmt(effect['paired_ci95_s'][1]),'RelGain':fmt(effect['relative_improvement_pct']),
  'FitUpR':fmt(fit['up']['r2_test'],3),'FitDownR':fmt(fit['down']['r2_test'],3),
  'FitUpMAE':fmt(fit['up']['mae_test'],3),'FitDownMAE':fmt(fit['down']['mae_test'],3)}
  for name,value in values.items():lines.append(cmd(name,value))
  (root/'metriche_generate.tex').write_text(''.join(lines),encoding='utf-8')

def main():
  ap=argparse.ArgumentParser();ap.add_argument('--config',default='parametri_ascensori.json');ap.add_argument('--skip-sim',action='store_true');a=ap.parse_args()
  root=Path(__file__).resolve().parent
  config_path=Path(a.config).resolve()
  out=root/'risultati';out.mkdir(exist_ok=True)
  if not a.skip_sim:
    subprocess.run([sys.executable,str(root/'simulatore_ascensori.py'),'--config',str(config_path),'--out',str(out)],check=True,cwd=root)
  config=json.loads(config_path.read_text(encoding='utf8'))
  res=json.loads((out/'risultati_sintesi.json').read_text(encoding='utf8'))
  write_macros(config,res,root)
  for i in range(2):
    cp=subprocess.run(['lualatex','-interaction=nonstopmode','-halt-on-error','rapporto_ascensori.tex'],cwd=root,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
    if cp.returncode:
      print(cp.stdout[-4500:]);raise SystemExit(cp.returncode)
  print('PDF creato:',root/'rapporto_ascensori.pdf')

if __name__=='__main__':main()

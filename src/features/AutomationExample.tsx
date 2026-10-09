import { useState } from 'react';
import { createDefaultScenario } from '../model/defaults';
import { hashValue } from '../model/reproducibility';
import type { OdRequest } from '../model/contracts';
import { useSimulationJob } from './useSimulationJob';
import { CabinLoadChart, TimelineChart } from './results/Charts';
import { downloadJson, seconds } from './results/data';
import Replay from './replay/Replay';
import '../styles/simulator.css';

export default function AutomationExample() {
  const [floor,setFloor]=useState(6),[cars,setCars]=useState(2),[people,setPeople]=useState(3),[capacity,setCapacity]=useState(2),[preparing,setPreparing]=useState(false);
  const job=useSimulationJob();
  const signature=`${floor}:${cars}:${people}:${capacity}`,busy=preparing||job.status==='running';
  const old=job.result?.scenario;
  const previous=!!old&&(busy||`${old.upperFloors}:${old.cabins.length}:${old.offices[0].employees}:${old.cabins[0].maxPeople}`!==signature);
  async function run() {
    setPreparing(true);
    try {
      const scenario=createDefaultScenario();
      scenario.upperFloors=floor;scenario.cabins=Array.from({length:cars},(_,id)=>({id,ratedLoadKg:1000,maxPeople:capacity}));
      scenario.offices=[{id:'ESEMPIO',floor,employees:people,lunchStartHour:13,lunchParticipation:.72}];
      scenario.seeds.simulation=['101'];scenario.startS=9*3600;scenario.endS=scenario.startS+10*60;
      scenario.sourceOnlyMetadata={explanatoryControlledCase:true,description:'Chiamate individuali dichiarate, non campionate; stesso motore del simulatore.'};
      const requests:OdRequest[]=Array.from({length:people},(_,id)=>({id,officeId:'ESEMPIO',bornS:scenario.startS+2*id,origin:0,destination:floor,weightKg:80,tripType:'arrival'}));
      const content={generatorVersion:'manual.fixed80.1',seed:'101',requests};
      job.explain(scenario,{...content,datasetHash:await hashValue(content)});
    } finally {setPreparing(false);}
  }
  const result=job.result?.results[0];
  return <div className="automation-example">
    <div className="simple-example-controls"><label>Piano da raggiungere<select aria-label="Piano da raggiungere" value={floor} onChange={e=>setFloor(Number(e.target.value))}>{[1,2,3,4,6,8,10,12].map(n=><option value={n} key={n}>Piano {n}</option>)}</select></label><label>Cabine disponibili<select aria-label="Cabine disponibili" value={cars} onChange={e=>setCars(Number(e.target.value))}>{[1,2,3,4].map(n=><option value={n} key={n}>{n} {n===1?'cabina':'cabine'}</option>)}</select></label><label>Persone in partenza<select aria-label="Persone in partenza" value={people} onChange={e=>setPeople(Number(e.target.value))}>{[1,2,3,4].map(n=><option value={n} key={n}>{n} {n===1?'persona':'persone'}</option>)}</select></label><label>Posti per cabina<select aria-label="Posti per cabina" value={capacity} onChange={e=>setCapacity(Number(e.target.value))}>{[1,2,3,4].map(n=><option value={n} key={n}>{n} {n===1?'posto':'posti'}</option>)}</select></label></div>
    <p className="field-note">Tutte le cabine partono vuote dal piano 0. Una persona chiama ogni 2 secondi; tutte vanno allo stesso piano. Massa fissa 80 kg, portata 1000 kg. Politica: greedy sul costo J.</p>
    <div className="run-actions"><button type="button" className="button" disabled={busy} onClick={()=>void run()}>{busy?'Calcolo in corso…':'Osserva l’automazione'} <span aria-hidden="true">↗︎</span></button>{busy&&<button type="button" className="quiet-button" onClick={job.cancel}>Annulla</button>}</div>
    <div role="status" aria-live="polite" className="run-status">{job.status==='error'?job.issues.map(i=>i.message).join(' '):job.status==='cancelled'?'Calcolo annullato.':busy?'Il motore sta calcolando il caso.':previous?'Hai modificato il caso: esegui per aggiornare i grafici.':!result?'Premi “Osserva l’automazione” per ottenere eventi e grafici calcolati.':''}</div>
    {result&&job.result&&<div className={previous?'example-output is-previous':'example-output'}><div className="example-outcome"><p className="eyebrow">{previous?'Caso precedente':'Il caso calcolato'}</p><h3>{result.kpis.completed} di {result.kpis.generated} persone arrivate a destinazione.</h3><p>Attesa media: <strong>{seconds(result.kpis.meanWaitS)}</strong> · Viaggio medio: <strong>{seconds(result.kpis.meanRideS)}</strong>.</p><p>Il limite di posti filtra i piani possibili; la politica confronta l’aumento del costo di attesa e viaggio. Le decisioni seguenti mostrano il candidato scelto, senza suggerire un ottimo globale.</p></div>
      <TimelineChart outcomes={result.outcomes}/><CabinLoadChart result={result} scenario={job.result.scenario}/>
      <details className="decision-inspector"><summary>Che cosa ha deciso per ogni chiamata?</summary><div className="table-scroll" role="region" tabIndex={0} aria-label="Tabella scorribile"><table><caption>Assegnazioni autentiche. ETA è il tempo previsto al momento della scelta, diverso dall’attesa osservata finale.</caption><thead><tr><th>Persona</th><th>Cabina scelta</th><th>Pickup previsto da ora</th><th>Incremento J</th></tr></thead><tbody>{(result.trace??[]).filter(e=>e.kind==='ASSIGN').map(e=><tr key={e.sequence}><th>{(e.requestId??0)+1}</th><td>{String.fromCharCode(65+(e.carId??0))}</td><td>{seconds(e.links[0]?.symbolValues.eta_s??null)}</td><td>{seconds(e.links[0]?.symbolValues.delta_J_s??null)} equivalenti</td></tr>)}</tbody></table></div></details>
      <Replay result={result} scenario={job.result.scenario}/><button type="button" className="quiet-button" onClick={()=>downloadJson(job.result,'ascensori-esempio.json')}>Scarica eventi e dati del caso</button>
    </div>}
  </div>;
}

import { useId, useMemo, useState, type PointerEvent } from 'react';
import type { PolicyResult, RequestOutcome, ScenarioV2 } from '../../model/contracts';
import { completedWaits, POLICY_COLORS, POLICY_NAMES, seconds, timelineRows, timeBuckets } from './data';
import { cdfAt, nearestWaitIndex } from './cdf';

export function TimelineChart({outcomes}:{outcomes:readonly RequestOutcome[]}) {
  const rows=timelineRows(outcomes),max=Math.max(1,...rows.map(r=>r.journeyS??0));
  return <figure className="data-figure"><figcaption><h3>Attesa e viaggio, per persona</h3><p>Durata in secondi dalla chiamata: la parte tratteggiata è attesa, la parte piena è viaggio a bordo.</p></figcaption>
    <div className="chart-legend"><span><i className="wait-swatch"/> Attesa</span><span><i className="ride-swatch"/> Viaggio</span></div>
    <div className="timeline-chart" aria-hidden="true">{rows.map(r=><div className="timeline-row" key={r.id}><span>Persona {r.id+1}<small>{r.origin} → {r.destination}</small></span><div className="timeline-track">{r.waitS!==null&&<i className="timeline-wait" style={{width:`${100*r.waitS/max}%`}}/>}{r.rideS!==null&&<i className="timeline-ride" style={{width:`${100*r.rideS/max}%`}}/>}</div><strong>{seconds(r.journeyS)}</strong></div>)}</div>
    <details className="chart-table"><summary>Leggi i valori della timeline</summary><div className="table-scroll" role="region" tabIndex={0} aria-label="Tabella scorribile"><table><caption>Durate calcolate, in secondi; non disponibili per spostamenti incompleti.</caption><thead><tr><th>Persona</th><th>Percorso</th><th>Attesa (s)</th><th>Viaggio (s)</th><th>Totale (s)</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><th>{r.id+1}</th><td>{r.origin} → {r.destination}</td><td>{seconds(r.waitS)}</td><td>{seconds(r.rideS)}</td><td>{seconds(r.journeyS)}</td></tr>)}</tbody></table></div></details>
  </figure>;
}

export function CabinLoadChart({result,scenario}:{result:PolicyResult;scenario:ScenarioV2}) {
  const id=useId(),trace=result.trace??[];
  const service=trace.filter(e=>e.kind==='PICKUP'||e.kind==='DROP'||e.kind==='ARRIVE');
  const start=scenario.startS,end=Math.max(start+1,...result.outcomes.map(r=>r.finishS??r.pickupS??r.bornS))+2;
  const maxLoad=Math.max(80,...scenario.cabins.map(c=>c.ratedLoadKg));
  const x=(time:number)=>48+552*(time-start)/(end-start),y=(load:number)=>170-130*load/maxLoad;
  const series=scenario.cabins.map(c=>{
    const points:[number,number][]=[[start,0]];let previous=0;
    for(const event of service) for(const change of event.carChanges) if(change.id===c.id&&event.timeS<=end){points.push([event.timeS,previous],[event.timeS,change.actualWeightKg]);previous=change.actualWeightKg;}
    points.push([end,previous]);
    return {c,points,peak:Math.max(...points.map(p=>p[1]))};
  });
  const colors=['#25637D','#73569C','#32685A','#8A613C','#095A6A','#822f49','#495061','#4b692e'];
  return <figure className="data-figure"><figcaption><h3>Carico delle cabine durante il servizio</h3><p>Una persona aggiunge 80 kg. Le linee salgono all’imbarco e scendono allo sbarco, secondo gli eventi del motore.</p></figcaption>
    <div className="chart-legend">{series.map(({c},i)=><span key={c.id}><i style={{background:colors[i]}}/> Cabina {String.fromCharCode(65+c.id)}</span>)}</div>
    <div className="svg-chart-scroll" tabIndex={0} aria-label="Grafico dei carichi, scorribile sui piccoli schermi"><svg viewBox="0 0 640 210" role="img" aria-labelledby={id}><title id={id}>Carico in kg rispetto ai secondi dall’inizio del caso. I limiti individuali sono nella tabella.</title>
      {[0,.5,1].map(p=><g key={p}><line x1="48" x2="600" y1={y(maxLoad*p)} y2={y(maxLoad*p)} className="gridline"/><text x="42" y={y(maxLoad*p)+4} textAnchor="end">{Math.round(maxLoad*p)}</text></g>)}
      <text x="48" y="20">Carico (kg)</text><text x="600" y="199" textAnchor="end">Tempo dall’inizio (s)</text><text x="48" y="190">0</text><text x="600" y="190" textAnchor="end">{(end-start).toFixed(1)}</text>
      {series.map(({c,points},i)=><g key={c.id}><line x1="48" x2="600" y1={y(c.ratedLoadKg)} y2={y(c.ratedLoadKg)} stroke={colors[i]} strokeDasharray="3 5" opacity=".7"/><path d={points.map(([t,l],j)=>`${j?'L':'M'}${x(t)},${y(l)}`).join(' ')} fill="none" stroke={colors[i]} strokeWidth="2.5" strokeDasharray={i%2?'8 3':undefined}/></g>)}
    </svg></div>
    <p className="chart-note">Tratteggi orizzontali: portate fisiche Q. Margine di pianificazione: 96% della portata, oltre al limite di posti. Sono limiti distinti.</p>
    <div className="table-scroll" role="region" tabIndex={0} aria-label="Tabella scorribile"><table><caption>Carichi e limiti per cabina</caption><thead><tr><th>Cabina</th><th>Massimo osservato</th><th>Portata</th><th>Posti pianificabili</th></tr></thead><tbody>{series.map(({c,peak})=><tr key={c.id}><th>{String.fromCharCode(65+c.id)}</th><td>{peak} kg</td><td>{c.ratedLoadKg} kg</td><td>{Math.min(c.maxPeople,Math.floor(.96*c.ratedLoadKg/80))} persone</td></tr>)}</tbody></table></div>
  </figure>;
}

export function WaitCdf({results}:{results:readonly PolicyResult[]}) {
  const id=useId(),[selected,setSelected]=useState<number|null>(null);
  const series=useMemo(()=>(['fifo','optimal','adaptive'] as const).filter(p=>results.some(r=>r.policy===p)).map(policy=>({policy,waits:completedWaits(results,policy)})),[results]);
  const samples=useMemo(()=>[...new Set(series.flatMap(s=>s.waits))].sort((a,b)=>a-b),[series]);
  const max=Math.max(1,...series.map(s=>s.waits.at(-1)??0));
  const active=selected===null||!samples.length?null:Math.min(selected,samples.length-1),threshold=active===null?null:samples[active];
  const readings=threshold===null?[]:series.map(s=>({...s,...cdfAt(s.waits,threshold)}));
  const percent=(value:number|null)=>value===null?'Non disponibile':`${new Intl.NumberFormat('it-IT',{maximumFractionDigits:1}).format(value)}%`;
  function inspect(event:PointerEvent<SVGSVGElement>) {
    const matrix=event.currentTarget.getScreenCTM();if(!matrix)return;
    const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());
    if(point.y<40||point.y>190)return;
    setSelected(nearestWaitIndex(samples,Math.max(0,Math.min(max,(point.x-50)*max/558))));
  }
  return <figure className="data-figure"><figcaption><h3>Quanto si aspetta?</h3><p>La curva mostra la percentuale di viaggi completati con attesa entro un certo numero di secondi. Più a sinistra indica attese inferiori nel campione osservato.</p></figcaption>
    <div className="chart-legend">{series.map(s=><span key={s.policy}><i style={{background:POLICY_COLORS[s.policy]}}/> {POLICY_NAMES[s.policy]} · {s.waits.length} viaggi</span>)}</div>
    {series.every(s=>s.waits.length===0)?<p>Nessun viaggio completato: la distribuzione delle attese non è disponibile.</p>:<><p className="chart-note" id={`${id}-help`}>Passa il cursore o tocca il grafico per leggere i dati del tempo osservato più vicino. Puoi usare anche il cursore sotto il grafico e le frecce della tastiera.</p><div className="svg-chart-scroll" tabIndex={0} aria-label="Distribuzione cumulata delle attese"><svg viewBox="0 0 640 230" role="img" aria-labelledby={id} onPointerMove={inspect} onPointerDown={inspect}><title id={id}>Distribuzione cumulata dei tempi d’attesa dei viaggi completati: asse x secondi, asse y percentuale.</title>
      {[0,25,50,75,100].map(p=><g key={p}><line x1="50" x2="608" y1={190-1.5*p} y2={190-1.5*p} className="gridline"/><text x="42" y={194-1.5*p} textAnchor="end">{p}%</text></g>)}
      {[0,.25,.5,.75,1].map(p=><text key={p} x={50+558*p} y="210" textAnchor={p===0?'start':p===1?'end':'middle'}>{Math.round(max*p)}</text>)}
      <text x="50" y="20">Viaggi completati (%)</text><text x="608" y="228" textAnchor="end">Attesa (s)</text>
      {series.map((s,i)=>{
        const step=Math.max(1,Math.ceil(s.waits.length/250));const points=s.waits.flatMap((w,j)=>j%step===0||j===s.waits.length-1?[[w,100*(j+1)/s.waits.length]]:[]);
        return <path key={s.policy} d={['M50,190',...points.map(([w,p])=>`L${50+558*w/max},${190-1.5*p}`)].join(' ')} stroke={POLICY_COLORS[s.policy]} strokeDasharray={i===1?'7 3':i===2?'2 4':undefined} fill="none" strokeWidth="2.5"/>;
      })}
      {threshold!==null&&<g aria-hidden="true"><line x1={50+558*threshold/max} x2={50+558*threshold/max} y1="40" y2="190" className="cdf-crosshair"/>{readings.filter(r=>r.percent!==null).map(r=><circle key={r.policy} cx={50+558*threshold/max} cy={190-1.5*r.percent!} r="4.5" fill={POLICY_COLORS[r.policy]} stroke="var(--surface)" strokeWidth="2"/>)}</g>}
    </svg></div><div className="cdf-inspector"><label htmlFor={`${id}-cursor`}>Attesa da esplorare</label><input id={`${id}-cursor`} type="range" min="0" max={samples.length-1} step="1" value={active??0} onFocus={()=>setSelected(active??0)} onChange={e=>setSelected(Number(e.target.value))} aria-describedby={`${id}-help`} aria-valuetext={threshold===null?'Seleziona un tempo osservato':`${seconds(threshold)}; ${readings.map(r=>`${POLICY_NAMES[r.policy]}: ${percent(r.percent)}`).join('; ')}`}/>
      <div className="cdf-point-readout" data-wait-seconds={threshold??undefined}>{threshold===null?<p>Seleziona un punto per confrontare le tre strategie.</p>:<><strong>Attesa entro {seconds(threshold)}</strong><ul>{readings.map(r=><li key={r.policy}><span><i style={{background:POLICY_COLORS[r.policy]}}/>{POLICY_NAMES[r.policy]}</span><span><strong>{percent(r.percent)}</strong> · {r.count} / {r.total} viaggi completati</span></li>)}</ul></>}</div>
    </div></>}
    <p className="chart-note">Campioni delle repliche raggruppati. La visualizzazione riduce i punti; la lettura interattiva, i calcoli e l’export usano tutti i dati. Una curva favorevole non compensa automaticamente richieste non completate.</p>
  </figure>;
}

export function FloorWaitChart({result}:{result:PolicyResult}) {
  const floors=[...new Set(result.outcomes.map(r=>r.origin))].sort((a,b)=>a-b);
  const rows=floors.map(floor=>{const all=result.outcomes.filter(r=>r.origin===floor),done=all.filter(r=>r.state==='DONE');return {floor,generated:all.length,completed:done.length,wait:done.length?done.reduce((s,r)=>s+r.pickupS!-r.bornS,0)/done.length:null};});
  const max=Math.max(1,...rows.map(r=>r.wait??0));
  return <figure className="data-figure"><figcaption><h3>L’attesa cambia da piano a piano</h3><p>Attesa media in secondi, per piano d’origine, nella replica selezionata. Il piano 0 è il piano terra.</p></figcaption><div className="floor-bars" aria-hidden="true">{rows.map(r=><div className="floor-bar" key={r.floor}><span>{r.floor===0?'Terra':`Piano ${r.floor}`}</span><i style={{width:`${100*(r.wait??0)/max}%`}}/><strong>{seconds(r.wait)}</strong></div>)}</div>
    <details className="chart-table"><summary>Valori e campioni per piano</summary><div className="table-scroll" role="region" tabIndex={0} aria-label="Tabella scorribile"><table><caption>Attesa sui soli viaggi completati della replica</caption><thead><tr><th>Piano</th><th>Generate</th><th>Completate</th><th>Attesa media</th></tr></thead><tbody>{rows.map(r=><tr key={r.floor}><th>{r.floor}</th><td>{r.generated}</td><td>{r.completed}</td><td>{seconds(r.wait)}</td></tr>)}</tbody></table></div></details>
  </figure>;
}

export function TimeWaitChart({result,scenario}:{result:PolicyResult;scenario:ScenarioV2}) {
  const rows=timeBuckets(result.outcomes,scenario.startS,scenario.endS,scenario.chartBinMinutes);
  const max=Math.max(1,...rows.map(r=>r.meanWaitS??0));
  const clock=(s:number)=>`${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor(s%3600/60)).padStart(2,'0')}`;
  return <figure className="data-figure"><figcaption><h3>Quando si concentra l’attesa?</h3><p>Media in secondi per orario della chiamata, in intervalli di {scenario.chartBinMinutes} minuti. Sono mostrati gli intervalli con richieste della replica selezionata.</p></figcaption>
    <div className="floor-bars" aria-hidden="true">{rows.map(r=><div className="floor-bar" key={r.startS}><span>{clock(r.startS)}</span><i style={{width:`${100*(r.meanWaitS??0)/max}%`}}/><strong>{seconds(r.meanWaitS)}</strong></div>)}</div>
    <details className="chart-table"><summary>Orari, campioni e richieste incomplete</summary><div className="table-scroll" tabIndex={0} aria-label="Valori per fascia oraria, scorribili"><table><caption>Attesa dei completati; le richieste incomplete restano nel conteggio della loro fascia</caption><thead><tr><th>Fascia</th><th>Generate</th><th>Completate</th><th>Incomplete</th><th>Attesa media (s)</th></tr></thead><tbody>{rows.map(r=><tr key={r.startS}><th>{clock(r.startS)}–{clock(r.endS)}</th><td>{r.generated}</td><td>{r.completed}</td><td>{r.unfinished}</td><td>{seconds(r.meanWaitS)}</td></tr>)}</tbody></table></div></details>
    <p className="chart-note">Una fascia con più attesa è un’osservazione. Il grafico da solo non dimostra che la causa sia il traffico: confronta conteggi, vincoli ed eventi.</p>
  </figure>;
}

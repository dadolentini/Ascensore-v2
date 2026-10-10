import { useEffect, useId, useMemo, useState } from 'react';
import type { PolicyResult, ScenarioV2 } from '../../model/contracts';
import { replayAt } from './state';

const labels:Record<string,string>={NEW:'Chiamata',ASSIGN:'Assegnazione',DEPART:'Partenza',ARRIVE:'Arrivo / fermata',PICKUP:'Salita in cabina',DROP:'Uscita dalla cabina',DOOR:'Fine sosta',PARK:'Riposizionamento',KEEP:'Cabina disponibile',RETRY:'Rivalutazione'};
const clock=(s:number)=>`${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor(s%3600/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`;
export default function Replay({result,scenario}:{result:PolicyResult;scenario:ScenarioV2}) {
  const [index,setIndex]=useState(-1),[playing,setPlaying]=useState(false),[reduced,setReduced]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const titleId=useId(),trace=result.trace??[];
  useEffect(()=>{setIndex(-1);setPlaying(false);},[result]);
  useEffect(()=>{const media=window.matchMedia('(prefers-reduced-motion: reduce)');const update=()=>{setReduced(media.matches);setPlaying(false);};media.addEventListener('change',update);const visibility=()=>{if(document.hidden)setPlaying(false);};document.addEventListener('visibilitychange',visibility);return()=>{media.removeEventListener('change',update);document.removeEventListener('visibilitychange',visibility);};},[]);
  useEffect(()=>{if(!playing||reduced)return;const timer=window.setInterval(()=>setIndex(value=>{if(value>=trace.length-1){setPlaying(false);return value;}return value+1;}),350);return()=>window.clearInterval(timer);},[playing,reduced,trace.length]);
  const state=useMemo(()=>result.initialSnapshot?replayAt(result.initialSnapshot,trace,index):null,[result,trace,index]);
  if(!state||!trace.length)return <p>Gli eventi non sono stati registrati per questa giornata.</p>;
  const event=index>=0?trace[index]:null;
  return <section className="replay" aria-labelledby={titleId}><h3 id={titleId}>Segui gli eventi della simulazione</h3><p>Rivedi chiamate, partenze e arrivi già calcolati. La vista avanza da un evento al successivo: mentre una cabina viaggia, indica il piano di partenza e quello da raggiungere. Riprodurre gli eventi non avvia un nuovo calcolo.</p>
    <div className="replay-controls"><button type="button" className="button button-small" disabled={reduced} onClick={()=>setPlaying(!playing)}>{playing?'Pausa':'Riproduci eventi'}</button><button type="button" className="quiet-button" disabled={index<0} onClick={()=>{setPlaying(false);setIndex(index-1);}}>Precedente</button><button type="button" className="quiet-button" disabled={index>=trace.length-1} onClick={()=>{setPlaying(false);setIndex(index+1);}}>Successivo</button><span>{clock(state.timeS)} · {index+1} / {trace.length}</span></div>
    {reduced&&<p className="field-note">Movimento ridotto attivo: usa i controlli per leggere uno stato alla volta.</p>}
    <label className="replay-seek">Scegli un evento della giornata<input type="range" min="-1" max={trace.length-1} value={index} onChange={e=>{setPlaying(false);setIndex(Number(e.target.value));}}/></label>
    <div className="cabins-state">{state.cars.map(c=><div key={c.id}><span>Cabina {String.fromCharCode(65+c.id)}</span><strong>{c.mode==='moving'?`${c.floor} → ${c.nextFloor}`:`Piano ${c.floor}`}</strong><span>{c.mode==='moving'?'In movimento':c.mode==='dwelling'?'Sosta porte':'Disponibile'}</span><small>{c.onboardIds.length} persone · {c.actualWeightKg} kg</small></div>)}</div>
    <p role="status" aria-live={playing?'off':'polite'} className="event-description">{event?`${clock(event.timeS)} — ${labels[event.kind]??event.kind}${event.carId!==undefined?` · Cabina ${String.fromCharCode(65+event.carId)}`:''}${event.requestId!==undefined?` · Richiesta ${event.requestId+1}`:''}`:'Stato iniziale: tutte le cabine vuote al piano 0.'}</p>
    {event?.links.length? <details className="event-details"><summary>Vedi il calcolo di questa decisione</summary>{event.links.map((link,i)=><div key={i}><p>{link.equationId} · <code>{link.codeRef}</code></p><div className="table-scroll" role="region" tabIndex={0} aria-label="Tabella scorribile"><table><caption>Valori registrati nella decisione; unità nei nomi dei campi</caption><tbody>{Object.entries(link.symbolValues).map(([symbol,value])=><tr key={symbol}><th>{symbol}</th><td>{Number.isInteger(value)?value:value.toFixed(4)}</td></tr>)}</tbody></table></div></div>)}</details>:null}
    <p className="field-note">Edificio: {scenario.upperFloors} piani sopra terra più il piano terra, indicato con 0. Le posizioni mostrate appartengono agli eventi registrati: non ricostruiamo posizioni intermedie durante il viaggio.</p>
  </section>;
}

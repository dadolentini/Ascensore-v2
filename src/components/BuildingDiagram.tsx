import { useEffect, useId, useRef, useState } from 'react';
import '../styles/building-diagram.css';

export default function BuildingDiagram() {
  const title = useId();
  const figure=useRef<HTMLElement>(null);
  const [visible,setVisible]=useState(false),[paused,setPaused]=useState(false),[reduced,setReduced]=useState(false);
  useEffect(()=>{
    const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference=()=>setReduced(preference.matches);
    updatePreference();preference.addEventListener('change',updatePreference);
    let inView=false;
    const updateVisibility=()=>setVisible(inView&&!document.hidden);
    document.addEventListener('visibilitychange',updateVisibility);
    const observer=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(([entry])=>{inView=entry.isIntersecting;updateVisibility();},{threshold:.15});
    if(observer&&figure.current)observer.observe(figure.current);else{inView=true;updateVisibility();}
    return ()=>{observer?.disconnect();preference.removeEventListener('change',updatePreference);document.removeEventListener('visibilitychange',updateVisibility);};
  },[]);
  return <figure ref={figure} className="building-figure diagram-motion" data-motion={reduced?'reduced':visible&&!paused?'running':'paused'}>
    <svg viewBox="0 0 680 500" role="img" aria-labelledby={title} className="building-diagram">
      <title id={title}>Quattro vani con cabine A, B, C e D; piano terra 0 e piani sopra terra fino a N. Posizioni schematiche, nessuna simulazione.</title>
      <rect x="80" y="35" width="510" height="405" fill="none" stroke="var(--ocean)" strokeWidth="1.2" />
      {[35,116,197,278,359,440].map((y,i) => <g key={y}><line x1="65" y1={y} x2="600" y2={y} stroke="var(--ocean)" opacity=".23"/><text x="34" y={y+6} fill="currentColor" fontSize="15">{i===0?'N':i===5?'0':'·'}</text></g>)}
      {[120,240,360,480].map((x,i) => <g key={x}>
        <rect x={x} y="53" width="70" height="369" fill="var(--ocean)" opacity=".07" />
        <line x1={x+35} x2={x+35} y1="53" y2="422" stroke="var(--ocean)" opacity=".25" strokeDasharray="3 6" />
        <g className={`diagram-car diagram-car-${i}`} aria-hidden="true"><rect x={x+5} y={[304,142,223,385][i]} width="60" height="37" fill="var(--surface)" stroke="var(--ocean)" strokeWidth="2" />
        <line x1={x+35} x2={x+35} y1={[304,142,223,385][i]} y2={[341,179,260,422][i]} stroke="var(--ocean)" /></g>
        <text x={x+35} y="480" textAnchor="middle" fontSize="18" fill="currentColor">{['A','B','C','D'][i]}</text>
      </g>)}
      <path d="M 600 397 L 620 397 M 615 392 L 620 397 L 615 402" fill="none" stroke="var(--ocean)" strokeWidth="2" />
    </svg>
    <figcaption>Schema illustrativo — movimenti narrativi di 4 cabine, senza simulazione. A–D identificano le cabine, 0 il piano terra, N l'ultimo piano sopra terra.</figcaption>
    {!reduced&&<button type="button" className="diagram-motion-toggle" aria-pressed={paused} onClick={()=>setPaused(value=>!value)}><span aria-hidden="true">{paused?'▷':'Ⅱ'}</span>{paused?'Riprendi il disegno':'Metti in pausa il disegno'}</button>}
  </figure>;
}

import Simulator from '../features/Simulator';
import BuildingDiagram from '../components/BuildingDiagram';
import RouteLink from '../components/RouteLink';
import { withBasePath } from '../navigation/paths';
import { policies } from '../content/model';
import useLandingMotion from '../features/useLandingMotion';
import '../styles/landing-motion.css';

function Eyebrow({ n, children }: { n: string; children: React.ReactNode }) { return <p className="eyebrow" data-landing-reveal><span>{n}</span>{children}</p>; }

export default function Landing() {
  const motionRef = useLandingMotion();
  return <>
    <section ref={motionRef} className="hero container" aria-labelledby="hero-title">
      <div className="hero-copy">
        <p className="eyebrow" data-landing-reveal><span className="tiny-square" />Uno studio sulla mobilità verticale</p>
        <h1 id="hero-title"><span className="hero-line" data-landing-reveal>Il tempo,</span><br/><span className="hero-line" data-landing-reveal data-landing-delay="65">tra un piano</span><br/><span className="hero-line" data-landing-reveal data-landing-delay="130">e <em>l'altro.</em></span></h1>
        <p className="hero-intro" data-landing-reveal data-landing-delay="180">Esplora come le chiamate, la capacità delle cabine e il modo di organizzarle cambiano le attese delle persone.</p>
        <div className="hero-actions" data-landing-reveal data-landing-delay="210"><RouteLink className="button" href="/#simulatore">Configura uno scenario <span aria-hidden="true">↗︎</span></RouteLink><RouteLink className="text-link" href="/come-funziona">Come funziona <span aria-hidden="true">→</span></RouteLink></div>
        <div className="hero-footnote" data-landing-reveal data-landing-delay="250"><span className="vertical-line"/><p>Stesso edificio. Stessa domanda.<br/>Tre modi di prendere una decisione.</p></div>
      </div>
      <figure className="hero-visual">
        <div className="tower-frame" data-landing-parallax><img src={withBasePath('/assets/tower.webp')} alt="Torre illustrativa al crepuscolo, con facciata illuminata e linee verticali." width="960" height="1200" fetchPriority="high"/><span className="image-corner" aria-hidden="true">+</span></div>
        <figcaption><span>Architettura come riferimento visivo</span><span>Studio illustrativo / Elevator</span></figcaption>
      </figure>
      <div className="hero-bottom"><span>Domanda · Vincoli · Decisioni</span><a href="#problema">Esplora il sistema <span aria-hidden="true">↓</span></a></div>
    </section>

    <section id="problema" className="section container problem" aria-labelledby="problem-title">
      <Eyebrow n="01">Il problema</Eyebrow>
      <div className="section-heading"><h2 id="problem-title" data-landing-reveal>Un edificio.<br/><em>Molti ritmi.</em></h2><p data-landing-reveal data-landing-delay="70">Una chiamata è semplice. Un insieme di chiamate non lo è: persone, destinazioni e cabine condividono lo stesso spazio, ma chiedono servizio in momenti diversi.</p></div>
      <div className="problem-grid"><figure className="entrance-photo"><img src={withBasePath('/assets/entrance.webp')} alt="Ingresso architettonico illustrativo, tra vetrate, pietra e luce calda." width="1200" height="800" loading="lazy"/><figcaption>La soglia tra domanda e servizio.</figcaption></figure>
        <div className="request-steps"><article data-landing-reveal><span>01 / Domanda</span><h3>Qualcuno chiama.</h3><p>Il modello DCS conosce origine e destinazione alla chiamata.</p></article><article data-landing-reveal data-landing-delay="70"><span>02 / Attesa</span><h3>Un piano si costruisce.</h3><p>Ogni inserimento deve rispettare le richieste già a bordo e i limiti della cabina.</p></article><article data-landing-reveal data-landing-delay="140"><span>03 / Servizio</span><h3>Una corsa si completa.</h3><p>Attesa e viaggio si misurano sugli eventi effettivi del motore.</p></article></div>
      </div>
    </section>

    <section id="sistema" className="section system-section" aria-labelledby="system-title"><div className="container">
      <Eyebrow n="02">Il sistema</Eyebrow>
      <div className="system-grid"><div><h2 id="system-title" data-landing-reveal>Quattro cabine.<br/><em>Un equilibrio.</em></h2><p data-landing-reveal data-landing-delay="70">Questo schema racconta il sistema. Il tuo scenario può avere da 1 a 8 cabine e da 1 a 50 piani sopra terra, oltre al piano 0.</p><dl className="system-details" data-landing-reveal data-landing-delay="140"><div><dt>Corsa</dt><dd>Tempo di moto da distanza, velocità e accelerazione.</dd></div><div><dt>Fermata</dt><dd>Porte e trasferimento delle persone, una volta per fermata.</dd></div><div><dt>Capienza</dt><dd>Portata in kg e limite persone per ogni cabina.</dd></div></dl><p className="fixed-mass"><span aria-hidden="true">↳</span> 80 kg per persona — massa fissa nel modello.</p></div><BuildingDiagram/></div>
      <figure className="lift-strip"><img src={withBasePath('/assets/lift.webp')} alt="Dettaglio illustrativo di porte ascensore in metallo, nella lobby." width="1400" height="700" loading="lazy"/><figcaption>Materiali e proporzioni sono riferimenti visivi, non dati dell'impianto.</figcaption></figure>
    </div></section>

    <section id="politiche" className="section container" aria-labelledby="policies-title"><Eyebrow n="03">Come si organizzano</Eyebrow><div className="section-heading"><h2 id="policies-title" data-landing-reveal>Tre modi di organizzarsi.<br/><em>Lo stesso scenario.</em></h2><p data-landing-reveal data-landing-delay="70">Stesse persone, stesse chiamate e stessi ascensori. Cambia il modo di scegliere le fermate e dove le cabine libere aspettano la prossima chiamata.</p></div><div className="policy-grid">{policies.map((p,i)=><article className="policy" key={p.id} data-landing-reveal data-landing-delay={i*70}><div className="policy-top"><span>{p.number}</span></div><h3>{p.headline}</h3><p className="policy-name">{p.name}</p><p>{p.text}</p><p className="policy-detail">{p.detail}</p></article>)}</div><RouteLink className="text-link" href="/gli-algoritmi#politiche">Confronta le regole, non solo i nomi <span aria-hidden="true">→</span></RouteLink></section>

    <section id="matematica" className="section math-section" aria-labelledby="math-title"><div className="container"><Eyebrow n="04">Il criterio di scelta</Eyebrow><div className="math-heading"><h2 id="math-title" data-landing-reveal>Una buona scelta<br/><em>guarda oltre.</em></h2><div data-landing-reveal data-landing-delay="70"><p>La cabina più vicina può essere piena, o già impegnata con altre persone. Il sistema prova dove aggiungere la nuova chiamata e confronta le conseguenze sul piano.</p><RouteLink className="text-link" href="/come-funziona">Segui una decisione, passo dopo passo <span aria-hidden="true">↗︎</span></RouteLink></div></div><div className="math-legend"><article data-landing-reveal><span>01</span><h3>Chi sta aspettando</h3><p>Quanto manca al pickup previsto? La scelta considera tutte le richieste in attesa coinvolte nel piano.</p></article><article data-landing-reveal data-landing-delay="70"><span>02</span><h3>Chi aspetta troppo</h3><p>Le attese totali oltre 120 secondi ricevono una penalità crescente nel criterio di scelta.</p></article><article data-landing-reveal data-landing-delay="140"><span>03</span><h3>Chi deve arrivare</h3><p>Conta anche il viaggio residuo delle persone a bordo e di quelle che devono ancora salire.</p></article></div><p className="math-note">Se vuoi approfondire il criterio, la pagina Gli algoritmi collega ogni termine della funzione J alle variabili e al codice. <RouteLink href="/gli-algoritmi#obiettivo">Leggi la funzione obiettivo →</RouteLink></p></div></section>

    <section id="decisioni" className="section container decisions" aria-labelledby="decisions-title"><Eyebrow n="05">Dalla domanda alla decisione</Eyebrow><div className="section-heading"><h2 id="decisions-title" data-landing-reveal>Prima capire.<br/><em>Poi confrontare.</em></h2><p data-landing-reveal data-landing-delay="70">Scegli un edificio e le sue persone. Il simulatore confronta tre modi di organizzare gli ascensori, usando le stesse chiamate. Puoi poi cambiare i valori e vedere come cambiano le attese.</p></div><ol className="decision-flow"><li data-landing-reveal><span className="flow-number">01</span><h3>Configura l’edificio</h3><p>Indica piani, ascensori, persone e orari.</p><span className="flow-arrow" aria-hidden="true">→</span></li><li data-landing-reveal data-landing-delay="70"><span className="flow-number">02</span><h3>Confronta i tre sistemi</h3><p>Ogni sistema serve le stesse persone, rispettando la capacità delle cabine.</p><span className="flow-arrow" aria-hidden="true">→</span></li><li data-landing-reveal data-landing-delay="140"><span className="flow-number">03</span><h3>Guarda le attese</h3><p>Scopri quanto si aspetta e quanti viaggi vengono conclusi.</p></li></ol><div className="decisions-note"><span aria-hidden="true">＋</span><p>“Chiamate e previsione” usa le abitudini simulate degli uffici per preparare le cabine nei piani dove si attendono chiamate. Le richieste già ricevute vengono prima.</p></div></section>

    <section id="simulatore" className="section simulator-section" aria-labelledby="simulator-title"><div className="container"><Eyebrow n="06">Il tuo scenario</Eyebrow><div className="section-heading"><h2 id="simulator-title" data-landing-reveal>Metti il modello<br/><em>alla prova.</em></h2><p data-landing-reveal data-landing-delay="70">Configura l'edificio e avvia il confronto. I campi preparano una bozza: soltanto l'esecuzione produce i risultati dello scenario.</p></div><Simulator/></div></section>
  </>;
}

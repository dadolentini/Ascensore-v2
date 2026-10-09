import Simulator from '../features/Simulator';
import BuildingDiagram from '../components/BuildingDiagram';
import RouteLink from '../components/RouteLink';
import { policies } from '../content/model';

function Eyebrow({ n, children }: { n: string; children: React.ReactNode }) { return <p className="eyebrow"><span>{n}</span>{children}</p>; }

export default function Landing() {
  return <>
    <section className="hero container" aria-labelledby="hero-title">
      <div className="hero-copy">
        <p className="eyebrow"><span className="tiny-square" />Uno studio sulla mobilità verticale</p>
        <h1 id="hero-title">Il tempo,<br/>tra un piano<br/>e <em>l'altro.</em></h1>
        <p className="hero-intro">Esplora come domanda, capacità e politiche di assegnazione cambiano il servizio di un sistema di ascensori.</p>
        <div className="hero-actions"><RouteLink className="button" href="/#simulatore">Configura uno scenario <span aria-hidden="true">↗︎</span></RouteLink><RouteLink className="text-link" href="/come-funziona">Come funziona <span aria-hidden="true">→</span></RouteLink></div>
        <div className="hero-footnote"><span className="vertical-line"/><p>Stesso edificio. Stessa domanda.<br/>Tre modi di prendere una decisione.</p></div>
      </div>
      <figure className="hero-visual">
        <div className="tower-frame"><img src="/assets/tower.webp" alt="Torre illustrativa al crepuscolo, con facciata illuminata e linee verticali." width="960" height="1200" fetchPriority="high"/><span className="image-coordinate" aria-hidden="true">FIG. 01 / VERTICALITÀ</span><span className="image-corner" aria-hidden="true">+</span></div>
        <figcaption><span>Architettura come riferimento visivo</span><span>Studio illustrativo / V2</span></figcaption>
      </figure>
      <div className="hero-bottom"><span>Domanda · Vincoli · Decisioni</span><a href="#problema">Esplora il sistema <span aria-hidden="true">↓</span></a></div>
    </section>

    <section id="problema" className="section container problem" aria-labelledby="problem-title">
      <Eyebrow n="01">Il problema</Eyebrow>
      <div className="section-heading"><h2 id="problem-title">Un edificio.<br/><em>Molti ritmi.</em></h2><p>Una chiamata è semplice. Un insieme di chiamate non lo è: persone, destinazioni e cabine condividono lo stesso spazio, ma chiedono servizio in momenti diversi.</p></div>
      <div className="problem-grid"><figure className="entrance-photo"><img src="/assets/entrance.webp" alt="Ingresso architettonico illustrativo, tra vetrate, pietra e luce calda." width="1200" height="800" loading="lazy"/><figcaption>La soglia tra domanda e servizio.</figcaption></figure>
        <div className="request-steps"><article><span>01 / Domanda</span><h3>Qualcuno chiama.</h3><p>Il modello DCS conosce origine e destinazione alla chiamata.</p></article><article><span>02 / Attesa</span><h3>Un piano si costruisce.</h3><p>Ogni inserimento deve rispettare le richieste già a bordo e i limiti della cabina.</p></article><article><span>03 / Servizio</span><h3>Una corsa si completa.</h3><p>Attesa e viaggio si misurano sugli eventi effettivi del motore.</p></article></div>
      </div>
    </section>

    <section id="sistema" className="section system-section" aria-labelledby="system-title"><div className="container">
      <Eyebrow n="02">Il sistema</Eyebrow>
      <div className="system-grid"><div><h2 id="system-title">Quattro cabine.<br/><em>Un equilibrio.</em></h2><p>Questo schema racconta il sistema. Il tuo scenario può avere da 1 a 8 cabine e da 1 a 50 piani sopra terra, oltre al piano 0.</p><dl className="system-details"><div><dt>Corsa</dt><dd>Tempo di moto da distanza, velocità e accelerazione.</dd></div><div><dt>Fermata</dt><dd>Porte e trasferimento delle persone, una volta per fermata.</dd></div><div><dt>Capienza</dt><dd>Portata in kg e limite persone per ogni cabina.</dd></div></dl><p className="fixed-mass"><span aria-hidden="true">↳</span> 80 kg per persona — massa fissa nel modello.</p></div><BuildingDiagram/></div>
      <figure className="lift-strip"><img src="/assets/lift.webp" alt="Dettaglio illustrativo di porte ascensore in metallo, nella lobby." width="1400" height="700" loading="lazy"/><figcaption>Materiali e proporzioni sono riferimenti visivi, non dati dell'impianto.</figcaption></figure>
    </div></section>

    <section id="politiche" className="section container" aria-labelledby="policies-title"><Eyebrow n="03">Le politiche</Eyebrow><div className="section-heading"><h2 id="policies-title">Tre politiche.<br/><em>Lo stesso scenario.</em></h2><p>Il confronto usa la stessa domanda, la stessa flotta e gli stessi parametri fisici. Cambia il criterio con cui il sistema assegna e riposiziona le cabine.</p></div><div className="policy-grid">{policies.map(p=><article className="policy" key={p.id}><div className="policy-top"><span>{p.number}</span><span className="policy-id">{p.id}</span></div><h3>{p.headline}</h3><p className="policy-name">{p.name}</p><p>{p.text}</p><p className="policy-detail">{p.detail}</p></article>)}</div><RouteLink className="text-link" href="/gli-algoritmi#politiche">Confronta le regole, non solo i nomi <span aria-hidden="true">→</span></RouteLink></section>

    <section id="matematica" className="section math-section" aria-labelledby="math-title"><div className="container"><Eyebrow n="04">Il criterio di scelta</Eyebrow><div className="math-heading"><h2 id="math-title">Una buona scelta<br/><em>guarda oltre.</em></h2><div><p>La cabina più vicina può essere piena, o già impegnata con altre persone. Il sistema prova dove aggiungere la nuova chiamata e confronta le conseguenze sul piano.</p><RouteLink className="text-link" href="/come-funziona">Segui una decisione, passo dopo passo <span aria-hidden="true">↗︎</span></RouteLink></div></div><div className="math-legend"><article><span>01</span><h3>Chi sta aspettando</h3><p>Quanto manca al pickup previsto? La scelta considera tutte le richieste in attesa coinvolte nel piano.</p></article><article><span>02</span><h3>Chi aspetta troppo</h3><p>Le attese totali oltre 120 secondi ricevono una penalità crescente nel criterio greedy.</p></article><article><span>03</span><h3>Chi deve arrivare</h3><p>Conta anche il viaggio residuo delle persone a bordo e di quelle che devono ancora salire.</p></article></div><p className="math-note">Se vuoi approfondire il criterio, la pagina Gli algoritmi collega ogni termine della funzione J alle variabili e al codice. <RouteLink href="/gli-algoritmi#obiettivo">Leggi la funzione obiettivo →</RouteLink></p></div></section>

    <section id="decisioni" className="section container decisions" aria-labelledby="decisions-title"><Eyebrow n="05">Dalla domanda alla decisione</Eyebrow><div className="section-heading"><h2 id="decisions-title">Prima capire.<br/><em>Poi confrontare.</em></h2><p>La configurazione definisce il caso da studiare. Una simulazione produce osservazioni entro un orizzonte finito. I risultati raccontano quel caso, senza promettere una prestazione universale.</p></div><ol className="decision-flow"><li><span className="flow-number">01</span><h3>Definisci gli input</h3><p>Uffici e persone per piano, capienze individuali, fisica e seed.</p><span className="flow-arrow" aria-hidden="true">→</span></li><li><span className="flow-number">02</span><h3>Esegui il modello</h3><p>La domanda genera chiamate; i vincoli filtrano i piani fattibili; ogni politica sceglie.</p><span className="flow-arrow" aria-hidden="true">→</span></li><li><span className="flow-number">03</span><h3>Leggi le misure</h3><p>Viaggi completati, richieste incomplete e distribuzione delle attese.</p></li></ol><div className="decisions-note"><span aria-hidden="true">＋</span><p>L'adattiva apprende le abitudini degli uffici offline. Il forecast guida il parking; le chiamate reali mantengono la priorità.</p></div></section>

    <section id="simulatore" className="section simulator-section" aria-labelledby="simulator-title"><div className="container"><Eyebrow n="06">Il tuo scenario</Eyebrow><div className="section-heading"><h2 id="simulator-title">Metti il modello<br/><em>alla prova.</em></h2><p>Configura l'edificio e avvia il confronto. I campi preparano una bozza: soltanto l'esecuzione produce i risultati dello scenario.</p></div><Simulator/></div></section>
  </>;
}

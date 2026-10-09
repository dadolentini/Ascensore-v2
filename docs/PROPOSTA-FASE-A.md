# Ascensori V2 — proposta consolidata, Fase A

Data: 9 ottobre 2026. Aggiornamento: proposta e D1–D6 approvate, con **80 kg fissi per persona** e chiarimento sull'origine e confrontabilità di q_e/D_f. Fase B autorizzata e avviata; il progresso è registrato in [implementazione](IMPLEMENTAZIONE.md).
Repository: `dadolentini/Ascensore-v2`, indicato dall'utente e verificato sul ramo `main` al commit iniziale `70142514099d0395d74e4fb34051a4bdf57484c3`.
Il checkout conteneva soltanto `README.md`: lo stack è una proposta nuova. In V2 sono stati aggiunti esclusivamente documenti e istruzioni di progetto; il repository precedente non è stato modificato né riutilizzato.

## 1. Esito e percorso di lettura

Propongo una piattaforma React/TypeScript/Vite con motore matematico isolato in Web Worker, landing editoriale 2D e pagina `/gli-algoritmi`. Il prodotto eseguirà confronti riproducibili fra le tre politiche documentate, esponendo domanda, vincoli, risultati e limiti. La correttezza viene verificata prima dell'integrazione visiva.

Il materiale autorevole è completo per il caso sintetico omogeneo di riferimento, ma presenta divergenze tra rapporto e Python. Le correzioni D1–D5 e la specifica supplementare per capacità indipendenti sono approvate: il rapporto contempla Q_e/C_e nei vincoli, ma il grouping e il codice usano capacità comuni.

| Deliverable | Contenuto |
| --- | --- |
| [Specifica matematica](mathematics/SPECIFICA.md) | Formule, unità, politiche, eventi, metriche, audit e decisioni D1–D6. |
| [D6 — capacità individuali](mathematics/D6-CAPIENZE-INDIVIDUALI.md) | Estensione proposta, riduzione al caso omogeneo, riserva, target e casi numerici con massa fissa di 80 kg. |
| [Architettura](architecture/ARCHITETTURA.md) | Stack motivato, moduli, dati, worker, trace, test e alternative. |
| [Design e UX](design/DESIGN-UX.md) | Riferimenti visivi, palette, tipografia, wireframe, configuratore e accessibilità. |
| [Motion](design/MOTION.md) | Storyboard delle otto sezioni, trigger, mobile e reduced motion. |
| [Piano di sviluppo](PIANO-SVILUPPO.md) | Sequenza, dipendenze, ownership e verifiche di accettazione per la futura Fase B. |
| [Provenienza](sources/README.md) e [manifest](sources/MANIFEST.json) | Identità delle due fonti, 23 hash dei file e confini di autorità. |

## 2. Matematica: che cosa verrà realmente simulato

- Domanda sintetica da uffici espliciti: arrivi, partenze, pranzo/ritorno correlati, viaggi interni. Non si assume un processo Poisson né si inferiscono dati reali dal palazzo illustrato.
- DCS: origine e destinazione sono note alla chiamata per tutte le politiche. In V2 ogni persona pesa esattamente 80 kg: imbarco e pianificazione usano lo stesso valore, con il margine preventivo ρ distinto dal limite fisico.
- Legge di viaggio ideale triangolare/trapezoidale: con δ=h|f−g|, T=2√(δ/a) per δ≤v²/a, altrimenti T=δ/v+v/a. Sosta: porta + trasferimento × persone salite/scese.
- Vincoli simultanei su kg e persone; pickup prima del proprio drop; segmento già iniziato non deviabile. La pianificazione usa massa riservata e margine ρ, l'imbarco il limite reale Q.
- Obiettivo greedy: J somma attese residue, penalità quadratica oltre soglia e viaggio residuo; si sceglie l'inserimento fattibile con ΔJ minimo. Non è un ottimo globale.
- La NNLS descrive i flussi nei grafici. La politica adattiva usa un modello per ufficio appreso offline e il raggruppamento marginale delle cabine inattive. MPC, energia e apprendimento online restano fuori perimetro.

| Politica pubblica | ID originale | Significato |
| --- | --- | --- |
| Baseline euristica reattiva | `fifo` | Inserimento ETA + viaggio + ritardi indotti; non FIFO stretto né algoritmo commerciale. |
| Greedy sul costo J | `optimal` | Costo marginale e parcheggio per fasce. |
| Adattiva per ufficio | `adaptive` | Stesso dispatch greedy, diverso preposizionamento basato sul fit uffici. |

Baseline→greedy cambia obiettivo e parking insieme; greedy→adaptive confronta il parking. Tutte le politiche ricevono gli stessi OD, tempi e masse e le stesse caratteristiche fisiche. Ogni risultato è accompagnato da scenario, versione, seed, hash dataset e popolazione delle metriche.

## 3. Decisioni scientifiche e stato dell'approvazione

Le decisioni D1–D5 sono approvate con la modifica di massa richiesta il 9 ottobre 2026 («imposta 80kg per persona; dopodiché approvo»). D6 e Fase B sono autorizzate dalla successiva istruzione «valuta se specificare l'origine e validazione che q_e e D_f siano confrontabili; poi procedi». Le fonti originali restano identiche; il prodotto ha versione propria.

| ID | Proposta concreta | Effetto e autorizzazione richiesta |
| --- | --- | --- |
| D1 — comportamento del motore | Un solo motore prodotto, con versione corretta: ETA residuo dal segmento/evento reale; sosta prevista raggruppata per piano; sbarco prioritario; retry con alternativa ammissibile per ETA e protezione contro rifiuti reiterati nello stesso stato; timer di inattività per cabina. | Correzioni per aderire alle intenzioni documentali. Cambiano decisioni e numeri: il Python originale resta riferimento archivistico; nuovi risultati non ereditano i suoi vantaggi percentuali. |
| D2 — domanda | Ogni persona/richiesta pesa **80 kg fissi**, anche nella pianificazione; nessun campionamento del peso. Conservare clipping degli orari e distribuzione interna originale per N≥2, compreso il bias dichiarato; per N=1 probabilità interna 0, con motivazione visibile. | Modifica della massa approvata dall'utente. ρ=0,96 resta invariato; nuova versione del generatore/dataset e nuovi risultati. Gli output originali non sono risultati dello scenario a 80 kg. |
| D3 — raggruppamento | Rispettare il vincolo documentale sul numero di idle ammissibili meno la riserva. La riserva resta disponibile e non riceve un comando di riposizionamento; i target prodotti, compresa ogni copertura zonale, non devono annullare il limite per piano o il budget di allocazione. Senza capacità pianificabile non si genera copertura fittizia. | Il fallback originale può muovere la riserva e superare i limiti. La nuova semantica deve essere fissata in fixture prima dell'implementazione; con una sola cabina e riserva 1 non c'è raggruppamento proattivo. |
| D4 — orizzonte e metriche | Mantenere termine finito senza drain; mostrare generati, prelevati, completati, ancora WAIT/ONBOARD. W/R/T e quantili restano completed-only, con `null` quando non disponibili. | Le richieste incomplete non scompaiono. Nessuna media sui soli completati diventa prova di superiorità se i tassi di servizio differiscono. Eventuale drain richiede un diverso profilo. |
| D5 — parametrizzazione e RNG | F={0,…,N}, N=1…50 e m=1…8; uffici risolti espliciti, unità e validazione centrale. PRNG browser versionato, seed e hash; un dataset generato una volta viene riusato per tutte le politiche. | Stesso seed numerico non promette lo stesso campione di NumPy. Il port si verifica sul medesimo corpus OD; la geometria completa è obbligatoria e non si disabilitano gli estremi per aggirare i test. |
| D6 — capacità individuali | Specifica supplementare approvata: c_real=min(C_e,⌊Q_e/80⌋), c_plan=min(C_e,⌊0,96 Q_e/80⌋), q_e=0,82 c_plan. Il grouping usa copertura B_f=Σ_e q_e x_ef nella medesima funzione G. | Una riserva fra le idle eleggibili, massimo tre target per piano nella decisione corrente, nessun fallback che violi i vincoli. Non è un limite cumulativo sugli impegni PARK né sulla presenza fisica. |

D1–D6 definiscono il profilo approvato con massa fissa e capacità individuali. Per una cabina Q=1000 kg e C=13, 12 persone pesano 960 kg e 13 pesano 1040 kg: la capacità fisica è 12, e con ρ=0,96 anche quella pianificata è 12.

La [specifica D6](mathematics/D6-CAPIENZE-INDIVIDUALI.md) dimostra la riduzione B_f=q k_f per capacità comuni, senza promettere identità con il Python difettoso o ottimo globale. Esclude dal preposizionamento cabine senza capacità pianificabile e quelle con meno di 35 s continuativi di inattività. Le formule, i casi limite e la semantica per decisione sono ora concretamente revisionabili.

Gli orari hardcoded del parking per fasce e dei viaggi interni restano limiti dichiarati del profilo originale. La configurazione generale mostra soltanto parametri collegati ai calcoli; chiavi JSON inattive restano provenienza. La riparametrizzazione completa delle fasce richiede un'ulteriore decisione modellistica, non un controllo decorativo.

## 4. Architettura e motivazioni

React compone pagine e form; TypeScript rende espliciti i contratti; Vite gestisce build, worker e caricamento per route. Il worker evita di bloccare l'interfaccia durante i calcoli. Modello, domanda, DES, metriche e visualizzazione rimangono separati; React non sceglie cabine né modifica eventi.

L'oracolo Python offline verifica formule e il profilo archivistico su dataset identici. Le correzioni D1/D3 richiedono fixture nuove con aspettative approvate; la parità col riferimento difettoso non è il criterio di successo della versione corretta. Un backend Python locale è l'alternativa se diventa indispensabile replicare letteralmente il campionamento NumPy; aggiungerebbe un servizio e gestione dei job.

KaTeX per equazioni con MathML, un unico renderer SVG per diagrammi e grafici, CSS/WAAPI per motion, Vitest e Playwright per verifica. GSAP è un'opzione soltanto per una timeline che lo richieda; niente Lenis, 3D o libreria di stato aggiuntiva nella proposta iniziale. Versioni e licenze saranno controllate e fissate in Fase B.

## 5. Direzione artistica e motion

Concept: atelier editoriale di mobilità verticale. Avorio `#F5F1E8`, carbone `#1D2428`, ottone `#8A613C`; titoli Instrument Serif, lettura e dati Manrope con fallback immediati e font locali. Contrasti verificati sui token principali: testo 13,95:1, testo secondario 5,54:1, ottone 4,83:1 su avorio. La conformità effettiva verrà verificata sugli stati implementati.

Hero con torre statica, margini ampi e tipografia autorevole; fotografie di ingresso/lobby/porta usate come riferimenti illustrativi. Otto sezioni conservano la progressione richiesta: problema → sistema a quattro cabine → ottimizzazione → formule → decisioni → simulatore → risultati. «Gli algoritmi» resta visibile nella navigazione principale.

Scroll nativo, nessun pin o camera; transizioni 120–360 ms su dettagli non essenziali. Le formule sono complete prima dei highlight. Su mobile le sezioni diventano una colonna e il diagramma distingue overview da piano selezionato. Reduced motion elimina movimento automatico, reveal e loop.

Il replay, se approvato, legge un trace autentico e immutabile del motore: il codice allegato non lo esporta. Scroll, pausa e velocità di presentazione non influenzano simulazione o KPI; senza trace verificato si mostrano log/tabella e schemi dichiarati illustrativi.

## 6. Simulatore, risultati e pagina algoritmi

Il form separa edificio, uffici/personale, capacità/fisica, traffico e riproducibilità. Uffici per piano e addetti per ufficio sono espliciti; i totali sono derivati, senza ipotesi nascoste. Modificare i piani non sposta gli uffici automaticamente: si segnalano quelli fuori intervallo. N indica sempre i soli piani sopra terra; 0 è presente in riepilogo, diagramma e dati.

«Esegui il confronto» congela la configurazione. Modifiche successive restano bozza e marcano il risultato come precedente. Sono previsti validazione inline, stato vuoto, calcolo, annullamento, errore, risultato parziale e limiti motivati; nessuna percentuale di avanzamento decorativa.

Metriche iniziali: attesa media/mediana/p90/p95, viaggio e tempo totale, completate/incomplete, quota W>120 s, fermate, bypass e piani percorsi/parcheggio. CDF e fasce orarie sono ricavate dai record delle richieste completate, con piano d'origine, unità, conteggio campione e tabella accessibile. Media dei p95 giornalieri e p95 pooled restano distinti. Energia, utilizzo temporale e viaggi aggregati privi di definizione non diventano KPI inventati.

La pagina algoritmi espone problema, input/unità, formule autentiche, vincoli, tre politiche, fit offline, baseline, metodologia statistica e limiti; ogni formula collega fonte, funzione e output. Si distinguono osservazioni numeriche da causalità: nessuna promessa di miglioramento per ogni scenario.

## 7. Evidenze, criticità e completamento della Fase A

Quattro specialisti reali hanno lavorato in parallelo: Applied Mathematician, Web Architect, Web Designer e Motion Designer. L'architettura del motore è stata finalizzata dopo la specifica matematica; UX e motion hanno concordato scroll, stati e comportamento mobile. Una revisione indipendente mirata ha verificato criticità sostanziali del riferimento; il responsabile ha integrato i contratti dati e i deliverable.

- Audit dell'originale: quattro test passati, 24 simulazioni (8 seed × 3 politiche), CSV e due JSON riprodotti byte per byte; continuità della legge di viaggio verificata.
- Caso originale: W medio 95,7065 / 11,2203 / 11,0980 s; questi sono risultati sintetici del riferimento omogeneo 4 cabine/15 piani, non performance garantite della futura V2.
- Criticità: ETA/porte, precedenza sbarco, retry potenzialmente infinito, riserva/grouping, metriche su campione vuoto, parametri inattivi e capienze individuali non definite nel codice.
- Non eseguiti: build, test frontend, test del nuovo motore e validazione dell'intero dominio. L'applicazione non esiste ancora; nessuna dipendenza prodotto è stata installata in V2.
- Non eseguiti: push, deployment, pubblicazione e configurazione di infrastrutture esterne.

Architettura, UX/motion e D1–D6 sono approvate. La Fase B procede su autorizzazione esplicita successiva, con copertura q_e dichiarata come euristica documentale per conteggi equivalenti e non throughput calibrato. Il deployment pubblico conserva un'autorizzazione separata.

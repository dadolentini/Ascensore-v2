# Ascensori V2 — proposta di architettura, Fase A

> Fotografia della Fase A; l’implementazione e le integrazioni autorizzate sono documentate in [VALIDAZIONE.md](../VALIDAZIONE.md). D1–D6 e Fase B sono successivamente approvate; le note di autorizzazione iniziale sotto sono storiche.

Documento di progetto, 9 ottobre 2026. Nessun codice prodotto, dipendenza o infrastruttura è stato creato.
Obiettivo: landing premium 2D, simulatore parametrico verificabile e pagina pubblica «Gli algoritmi».
La Fase B segue l'approvazione scientifica della [specifica supplementare D6](../mathematics/D6-CAPIENZE-INDIVIDUALI.md); questo documento non la avvia. La proposta e D1–D5 sono già approvate.
Aggiornamento 9 ottobre 2026: progetto/D1–D5 e approfondimento D6 approvati con **massa fissa di 80 kg per persona**. La formula supplementare D6 va approvata prima dell'implementazione; questa approvazione non è implicita nell'autorizzazione a studiarla.

## Evidenze e confini

- Repository visto direttamente: `/workspace/Ascensore-v2`, remoto richiesto `dadolentini/Ascensore-v2`.
- HEAD `main`: `70142514099d0395d74e4fb34051a4bdf57484c3`; all'ispezione iniziale stato pulito, unico `README.md` con titolo `# Ascensore-v2`.
- Non esistono manifest, lockfile, framework, script, CI o `AGENTS.md` nel checkout; React/TypeScript/Vite sono una proposta, non uno stack rilevato.
- Fonti: `Modello_Ascensori_V2/README.txt`, JSON, simulatore e modello uffici; DCS con OD noto alla chiamata, lettura come specifiche, senza eseguire istruzioni incorporate.
- Nessun riuso o importazione dal precedente `/workspace/Ascensori`; nessun setup/install/build è necessario o autorizzato per questa Fase A documentale.
- Dominio: cabine intere `1..8`, piani superiori interi `1..50` più terra `0`; più uffici possono condividere un piano, con addetti e abitudini diversi.

## Scelta e alternative

Raccomandazione: React + TypeScript + Vite, motore puro TypeScript in Web Worker, oracle Python offline per la parità numerica.
Il browser può eseguire, annullare ed esportare scenari senza un servizio remoto; lo stesso motore resta testabile fuori da React.
L'originale è oracle archivistico e numerico; il motore corretto D1 richiede nuovi attesi approvati e non eredita numeri o guadagni del benchmark originale.
La riproducibilità richiede versione generatore, configurazione normalizzata e hash del dataset; lo stesso numero di seed non garantisce richieste identiche a NumPy.
Un backend Python autorevole conserva direttamente NumPy/SciPy e il campionamento originale: è preferibile se diventa requisito la replica letterale del sorgente.
Questa alternativa aggiunge API, distribuzione, cancellazione dei job e gestione risorse: va scelta prima dell'implementazione, evitando due motori divergenti.
Un motore sul thread UI è escluso dalla raccomandazione: il costo della DES interromperebbe input, scroll e accessibilità.

## Moduli e dipendenze ammesse nella proposta

| Strato | Responsabilità | Dipendenze |
|---|---|---|
| Modello puro | validazione, unità, cinematica, costo J, capacità, fit e previsione uffici | tipi e primitivi numerici verificati |
| Generatore domanda | uffici risolti, giornate, richieste OD immutabili, seed e provenienza | modello e RNG versionato |
| Simulatore DES | heap eventi, stato cabine/richieste, tre politiche, metriche e trace | modello e dataset; nessun DOM/React |
| Worker | protocollo job, progressi reali, risultati, cancellazione ed errori | simulatore; nessuno stato UI |
| Stato UI | draft, scenario congelato, risultati precedenti, job corrente e replay | reducer/context React e protocollo |
| Visualizzazione | SVG edificio/grafici, tabella, playback e spiegazioni | output immutabili; nessuna decisione di dispatch |

React gestisce form e composizione; TypeScript esplicita i confini; Vite compila worker e suddivide le pagine.
La proposta è client-rendered: HTML/noscript fornisce soltanto informazioni essenziali; nessuna promessa di landing completa senza JS, prerender o SSR implicito.
Usare reducer/context prima di aggiungere una libreria di stato; un controller unico possiede la vita del worker.
KaTeX è la proposta per formule locali in «Gli algoritmi», caricata con la pagina e con alternativa testuale/MathML.
CSS, Web Animations API e IntersectionObserver coprono microinterazioni e reveal; GSAP/ScrollTrigger resta opzionale per una timeline SVG motivata.
Nessun Lenis o pin; eventuale GSAP vive in un unico adattatore con cleanup e controllo reduced motion.
SVG custom è sufficiente per CDF, attese per fascia e confronto tra politiche; tabella semantica equivalente e descrizioni accessibili obbligatorie.
Non affiancare Recharts, Chart.js e D3: se il volume rende SVG inadatto, misurare prima e scegliere una sola alternativa in Fase B.
NNLS, CDF normale, percentili e l'eventuale Student t richiedono toolkit numerico verificato o moduli controllati dall'oracle; nessuna formula statistica improvvisata.

## Struttura proposta, non implementata

```text
index.html                         shell e fallback informativo noscript
src/app/routes.tsx                  /, /gli-algoritmi e collegamento #simulatore
src/app/RunController.ts            stato job e vita del worker
src/pages/LandingPage.tsx           narrazione e accesso al simulatore
src/pages/AlgorithmsPage.tsx        ipotesi, formule e provenienza
src/features/scenario/             form, preset e reducer del draft
src/features/results/              KPI, confronti, tabelle ed export
src/features/replay/                clock, controlli e BuildingSvg
src/model/contracts.ts             schema, unità e versioni
src/model/validate.ts               errori strutturati e normalizzazione
src/model/physics.ts                travel_seconds e capacità
src/model/numerics.ts               adattatore numerico verificato
src/model/officeModel.ts            apprendimento e forecast per ufficio
src/model/demand.ts                 dataset OD riproducibile
src/engine/policies/                FIFO, greedy e adaptive
src/engine/eventQueue.ts            ordine (timeS, insertionCounter)
src/engine/simulate.ts              DES, metriche, trace e diagnostica
src/worker/simulation.worker.ts     esecuzione isolata
src/worker/protocol.ts              messaggi serializzabili tipizzati
src/components/charts/             unico renderer SVG con tabelle
tests/oracle/                      fixture OD e attesi Python verificati
```

Le route profonde richiedono un fallback HTML nella futura distribuzione; non viene creata ora alcuna configurazione di hosting.

## Contratti dati essenziali, soltanto documentati

```ts
type PolicyId = 'fifo' | 'optimal' | 'adaptive';
type Seconds = number; type Floor = number; type Seed = string;
type JsonValue = string|number|boolean|null|readonly JsonValue[]|{readonly [key: string]: JsonValue};
type TripType = 'arrival' | 'departure' | 'lunch_exit' | 'lunch_return' | 'internal';
interface Office { id: string; floor: Floor; employees: number; lunchStartHour: number; lunchParticipation: number; }
interface Cabin { id: number; ratedLoadKg: number; maxPeople: number; }
interface Physical { floorHeightM: number; speedMps: number; accelerationMps2: number;
  doorBaseS: Seconds; passengerTransferS: Seconds; passengerWeightKg: 80; maxPlannedLoadFraction: 0.96; }
interface Traffic { arrivalMeanHour: number; arrivalSdMinutes: number; departureMeanHour: number; departureSdMinutes: number;
  lunchDurationMinutes: number; lunchSdMinutes: number; lunchStartHours: readonly number[]; internalTripsProbability: number; }
interface Dispatch { fairnessThresholdS: Seconds; rideTimeFactor: number; lateWaitFactor: number; relocationIdleDelayS: 35; }
interface Learning { habitSdMinutes: number; dailyJitterMinutes: number; priorEvents: number; priorWorkerDays: number; forecastHorizonMinutes: 12;
  leadMinutes: number; reserveIdleCars: 1; effectiveCapacityFraction: 0.82; minPredictedCalls: number; movementPenaltyPerS: number;
  coveragePenalty: number; maxGroupedCarsPerFloor: 3; }
interface SeedPlan { simulation: readonly Seed[]; habits: Seed; training: readonly Seed[]; validation: readonly Seed[]; }
interface ScenarioV2 { schemaVersion: '2'; modelVersion: string; upperFloors: Floor; cabins: readonly Cabin[]; physical: Physical; traffic: Traffic;
  dispatch: Dispatch; learning: Learning; offices: readonly Office[]; seeds: SeedPlan; startS: Seconds; endS: Seconds;
  fitTrainingDays: number; arrivalBinMinutes: number; chartBinMinutes: number; sourceOnlyMetadata: Readonly<Record<string, JsonValue>>; }
interface OdRequest { id: number; officeId: string; bornS: Seconds; origin: Floor; destination: Floor; weightKg: 80; tripType: TripType; }
interface RequestOutcome extends OdRequest { pickupS: Seconds|null; finishS: Seconds|null; state: 'WAIT'|'ONBOARD'|'DONE'; assignedCarId: number|null; }
interface Dataset { generatorVersion: string; seed: Seed; datasetHash: string; requests: readonly OdRequest[]; }
interface CarSnapshot { id: number; floor: Floor; nextFloor: Floor|null; mode: 'idle'|'moving'|'dwelling'; onboardIds: readonly number[]; actualWeightKg: number; departureS: Seconds|null; arrivalS: Seconds|null; eventVersion: number; }
interface ReplaySnapshot { timeS: Seconds; cars: readonly CarSnapshot[]; requests: readonly RequestOutcome[]; }
interface TraceLink { equationId: string; symbolValues: Readonly<Record<string, number>>; codeRef: string; outputField: string; }
interface TraceEvent { sequence: number; timeS: Seconds; heapOrder?: number; eventVersion?: number; kind: 'NEW'|'ARRIVE'|'DOOR'|'PARK'|'DEPART'|'ASSIGN'|'PICKUP'|'DROP'|'RETRY'|'KEEP';
  carId?: number; requestId?: number; fromFloor?: Floor; toFloor?: Floor; departureS?: Seconds; arrivalS?: Seconds; carChanges: readonly CarSnapshot[]; requestChanges: readonly RequestOutcome[]; links: readonly TraceLink[]; }
interface Kpis { generated: number; pickedUp: number; completed: number; waiting: number; onboard: number; unfinished: number; servedPct: number; meanWaitS: number|null;
  medianWaitS: number|null; p90WaitS: number|null; p95WaitS: number|null; waitOver120Pct: number|null; meanRideS: number|null; meanJourneyS: number|null;
  bypasses: number; distanceFloors: number; parkingFloors: number; doorStops: number; adaptiveParkingDecisions: number; maxGroupedSameFloor: number; }
interface PolicyResult { policy: PolicyId; seed: Seed; datasetHash: string; modelVersion: string; kpis: Kpis; outcomes: readonly RequestOutcome[]; initialSnapshot: ReplaySnapshot|null; trace: readonly TraceEvent[]|null; }
interface FlowFit { coefficients: readonly number[]; centersHour: readonly number[]; sigmasHour: readonly number[]; binEdgesHour: readonly number[];
  unit: 'requests/min'; trainMean: readonly number[]; holdoutMean: readonly number[]; predicted: readonly number[]; mae: number|null; r2: number|null; }
interface OfficeEstimate { officeId: string; floor: Floor; employees: number; learnedLunchHour: number; learnedSdMinutes: number; learnedParticipation: number; }
interface CabinCapacity { carId: number; physicalPeople: number; plannedPeople: number; effectiveCoverage: number; }
interface SimulationContext { scenarioFingerprint: string; officeModels: readonly OfficeEstimate[]; capacityByCar: readonly CabinCapacity[]; }
interface ExperimentResult { scenario: ScenarioV2; datasets: readonly Dataset[]; results: readonly PolicyResult[]; metricPopulations: { passenger: 'completed'; fleet: 'processed-events'; servedPctDenominator: 'generated'; waitOver120PctDenominator: 'completed' };
  flowFit: Readonly<Record<'up'|'down', FlowFit>>|null; officeEstimates: readonly OfficeEstimate[]; officeHoldoutMae: number|null; diagnosticsIssues: readonly Issue[]; }
type Issue = { code: string; path: string; message: string; details?: Readonly<Record<string, string|number>> };
type TraceSelection = { policy: PolicyId; seed: Seed } | null;
type WorkerIn = { type: 'RUN'; jobId: string; scenario: ScenarioV2; policies: readonly PolicyId[]; traceFor: TraceSelection } | { type: 'CANCEL'; jobId: string };
type WorkerOut = { type: 'PROGRESS'; jobId: string; phase: 'training'|'fitting'|'simulation'; timeS?: Seconds; processedEvents: number }
  | { type: 'DONE'; jobId: string; experiment: ExperimentResult } | { type: 'CANCELLED'; jobId: string }
  | { type: 'ERROR'; jobId: string; kind: 'invalid'|'unsupported'|'numerical'|'internal'; issues: readonly Issue[] };
```

`Seconds` indica secondi dall'inizio della giornata, non tempo wall-clock; tutti i numeri devono essere finiti, unità sempre visibili nei form.
Floor e `cabins.length` sono validati nel dominio; `Seed` è una stringa decimale canonica per evitare troncamenti JSON e conversioni implicite.
Gli ID interni delle cabine sono stabili e sequenziali `0..m−1`; le label A–H sono presentazione. Non si confondono ID, indice del piano e ordine di assegnazione.
Confine puro: `simulate(scenario: ScenarioV2, dataset: Dataset, policy: PolicyId, context: SimulationContext, traceEnabled: boolean): PolicyResult`; `runExperiment(scenario, policies, traceFor): ExperimentResult` prepara il fit comune.
DEPART/ASSIGN/PICKUP/DROP/RETRY sono record della futura instrumentazione, non nuovi eventi heap; `heapOrder/eventVersion` distinguono provenienza e stato pertinente.
L'importatore normalizza il JSON e conserva in sourceOnlyMetadata i campi inattivi: lobby_floor, office_start/end_hour, lunch_start_probabilities, relocation_forecast_horizon_minutes e recompute_parking_delay_seconds. La precedente politica di peso (weight_mean_kg, weight_sd_kg, weight_min_kg, weight_max_kg, robust_reserved_kg_per_future_passenger) è soltanto provenienza storica; V2 usa 80 kg fissi, inclusa la riserva per persona. I dataset V2 devono validare weightKg===80; la migrazione di fixture originali sostituisce esplicitamente la massa e registra un nuovo hash.
L'input uffici può essere automatico (numero/totale/focus) o esplicito: una sola normalizzazione produce `offices`, totale e distribuzione per piano.
ID unici, addetti interi positivi, piano `1..N`, probabilità `[0,1]`, somme coerenti e train/validation disgiunti; massa esattamente 80 kg, fisica positiva e tempi/scarti temporali validi sono controllati prima del job.
Q_e kg e C_e persone sono per cabina; D6 richiede la formula grouping eterogenea approvata. Capacità fisiche/pianificate sono derivate da Q_e/C_e, massa 80 e ρ: non sono input indipendenti. Una cabina con capacità pianificata 0 non è assegnabile dalla politica conservativa, anche se la capacità fisica è positiva; i risultati devono distinguere questi casi.
Il worker costruisce capacityByCar dallo scenario congelato e ne verifica il fingerprint; un cambiamento a una sola cabina invalida il contesto. Dispatch, imbarco e grouping condividono queste capacità, senza valori q_e inviati dalla UI. Nel profilo D6 massa, ρ, fattore 0,82, riserva 1, limite 3, timer 35 s e orizzonte forecast 12 min sono costanti validate, non nuovi controlli operativi.
Il limite di tre target e maxGroupedSameFloor contano le allocazioni della decisione corrente, inclusi target senza movimento e fallback; KEEP e PARK pregressi non sono ricontati. Il trace mostra separatamente decisione, movimento e presenza fisica, senza promettere un cap cumulativo.
Nessun clamp silenzioso per piano focus fuori range, valori non finiti o import incompatibili: errore localizzato o unsupported motivato; i limiti geometrici richiesti restano supportati.

## Esecuzione, confronto e riproducibilità

1. La run esplicita congela lo scenario; modificare il draft conserva il risultato con etichetta «scenario precedente».
2. Una fase comune risolve uffici e training; ogni seed genera una sola lista OD ordinata stabilmente, riutilizzata dalle tre politiche con stato separato.
3. Tutte le cabine iniziano al piano 0, inattive e vuote. La figura 0/5/10/15 del rapporto non definisce l'inizializzazione della DES.
4. Oracle e port ricevono lo stesso dataset; per D1 corretto si usano nuovi casi attesi, documentando le divergenze autorizzate dal riferimento originale.
5. Il confronto con FIFO usa orizzonte, parametri fisici, domanda, seed e versione modello comuni; differenze di servizio sono mostrate insieme alle attese.
6. Export JSON include dataset OD integrali, config/versioni/popoli metriche e trace selezionato; CSV espone esiti/KPI. Hash SHA-256 del JSON canonico RFC8785, richieste nell'ordine stabile born/ID.

La DES sorgente usa heap `(tempo, contatore d'inserimento)`; non introdurre una priorità per tipo di evento nei pareggi.
Conservare versioni e ordine degli eventi; la semantica del PARK segue la decisione D1/D3 approvata e distingue i timer corretti dal riferimento. Nessuna animazione o callback React può modificare ordine, stato o RNG.
L'orizzonte chiude senza drain; W/R/T/percentili e quota W>120 sono sui completati, servedPct sui generati; counters flotta includono eventi associati a richieste incomplete.
Se non esistono completamenti, il contratto rappresenta le statistiche come `null` con spiegazione; non serializzare NaN e non mostrare zero attesa come successo.
NNLS diagnostica non guida parking; campioni insufficienti producono fit assente con ragione, non R² inventato. Adaptive preposiziona soltanto idle usando fit uffici.
Nome pubblico di `optimal`: «Greedy sul costo J»; nessuna promessa di ottimo globale, MPC, controllo energia o apprendimento universale.
Le discrepanze documentate tra ETA, dwell, riserva e precedenza uscite richiedono una decisione approvata e una nuova `modelVersion`; mai mescolare risultati tra versioni.
Le finestre orarie fisse del sorgente restano dichiarate; cambiare l'orario di un ufficio non dimostra che ogni euristica sia stata riparametrizzata.
Il worker emette progressi osservati oppure stato indeterminato; jobId scarta messaggi tardivi. KPI/repliche sono mediati senza ponderare, CDF usa completati pooled, CI appaiata segue la specifica.
Cancellazione a intervalli di lavoro brevi, con termination controllata come fallback; nessun risultato cancellato è presentato come confronto completato.

## Visualizzazione, performance e accessibilità

Il simulatore mostra edificio SVG 2D `0..N`; con molti piani usa finestra/scroll e contesto, senza comprimere 51 etichette in un viewport mobile.
Il trace attuale del Python non esiste come export: l'instrumentazione fedele e il corpus verificato precedono qualsiasi replay di viaggi reali.
Il clock rAF legge trace immutabile; pausa, seek e velocità non rilanciano simulazioni né alterano KPI, richiesta o costi.
Separare departure/arrival, sosta porte e salite/discese: eventuale interpolazione grafica è dichiarata e non aggiunge easing narrativo ai viaggi.
Trace soltanto per run selezionata o off; snapshot iniziale e delta di entità ricostruiscono seek/carico. Un DONE serializza il risultato; misurare memoria senza promettere streaming non modellato.
Ridurre punti soltanto nella rappresentazione dei grafici, conservando dataset e statistiche integrali nell'export.
Il limite computazionale per addetti/repliche/trace va misurato sul dominio; un budget superato produce unsupported esplicito, non un calcolo diverso nascosto.
Reduced motion elimina movimento automatico e reveal; replay per evento precedente/successivo e tabella completa restano disponibili.
Una tab nascosta sospende il replay fino a ripresa esplicita; listener, observer, animazioni e rAF hanno cleanup verificabile.
Form con label/unità/errori associati, tastiera completa, focus dopo errore e live region moderata per esito run; nessun aggiornamento vocale per frame.
Grafici e cabine combinano colori, tratteggi e testo; le tooltip hanno equivalente da tastiera, contrasto e tabella leggibile senza SVG.
Landing illustrativa chiaramente distinta dai risultati; nessun KPI dimostrativo è presentato come calcolo del simulatore.

## Integrazione e verifiche per la Fase B

1. Approvare la nuova formulazione D6 e congelare lo schema; preparare corpus oracle con dataset OD, config, versione Python/NumPy/SciPy, valori ed eventi attesi. D1–D5 non richiedono una seconda approvazione.
2. Implementare modello/validazione e numerica; verificare viaggio triangolare/trapezoidale, frontiera kg/persone, forecast, NNLS e percentili con tolleranze motivate.
3. Implementare DES/politiche contro casi piccoli leggibili: pareggi temporali, uscite/entrate stesso piano, retry, evento obsoleto e censura a fine orizzonte.
4. Verificare determinismo e confronto appaiato; parità con l'oracle sui moduli immutati e fixture dedicate per le correzioni autorizzate, con invarianti su capacità fisica, pickup/finish e conservazione dei conteggi.
5. Integrare worker/controller/form; smoke test su run, errore, cancel/restart e messaggi tardivi; nessun risultato precedente attribuito al nuovo draft.
6. Integrare route/formule/grafici/replay; verificare build/typecheck, responsive, tastiera/reduced motion e carico ai bordi `m=1,8; N=1,50`.

N=1/viaggi interni, focus fuori piano, riserva con una cabina, fit scarso/null e capienze individuali sono decisioni D1–D6; il dominio geometrico resta obbligatorio.
Counts/assegnazioni/ordine devono coincidere con attesi del profilo approvato; errori floating ammessi soltanto con tolleranze concordate, non come deroga alle decisioni.
Non si dichiara validato l'intero dominio soltanto perché il benchmark 4 cabine/15 piani passa; il benchmark è una fixture, non la specifica universale.
La nuova formula D6 resta il gate scientifico; i limiti risorse e le scelte numeriche devono essere misurati/verificati secondo il piano. Nessun requisito di credenziali o servizio esterno è emerso in Fase A. Eliminare i draw del peso richiede generatorVersion distinta; non alterare le fixture archivistiche né attribuire loro i risultati del nuovo profilo.

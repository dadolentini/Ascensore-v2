# Ascensori V2 — piano di sviluppo proposto

> Piano originale conservato come traccia delle decisioni. L’implementazione autorizzata è ora realizzata; stato effettivo e verifiche sono in [VALIDAZIONE.md](VALIDAZIONE.md). Le checklist sotto mantengono la fotografia di pianificazione e non costituiscono il backlog corrente.

> Per gli agenti: l'utente ha autorizzato la Fase B con «valuta se specificare l'origine e validazione che q_e e D_f siano confrontabili; poi procedi». Eseguire con deleghe selettive e ownership distinta; nessuna review generica ripetuta.

Aggiornamento 9 ottobre 2026: D1–D6 e Fase B approvate. Chiarire la comparabilità dei conteggi equivalenti q_e/D_f senza attribuire validazione empirica al fattore 0,82. Progresso e verifiche in [IMPLEMENTAZIONE.md](IMPLEMENTAZIONE.md).

**Obiettivo:** una piattaforma premium 2D con simulazione verificabile, confronto delle politiche e spiegazione matematica tracciabile.
**Architettura:** modello e DES puri TypeScript in Worker; React gestisce configurazione e output immutabili; oracle Python offline per formule e profilo archivistico, fixture dedicate alle correzioni approvate.
**Stack proposto:** React, TypeScript, Vite, KaTeX, SVG, CSS/WAAPI; Vitest e Playwright. Toolkit numerico/RNG gratuito verificato; GSAP soltanto se serve alla timeline concordata.
**Specifica:** [proposta consolidata](PROPOSTA-FASE-A.md), [matematica](mathematics/SPECIFICA.md), [capacità individuali D6](mathematics/D6-CAPIENZE-INDIVIDUALI.md), [contratti](architecture/ARCHITETTURA.md), [UX](design/DESIGN-UX.md) e [motion](design/MOTION.md).

## Vincoli globali

- Repository esclusivo `dadolentini/Ascensore-v2`; nessun riuso del precedente progetto.
- N=1…50 conta i piani sopra terra, livelli 0…N; m=1…8. L'intero dominio geometrico resta obbligatorio.
- Nessun modello o risultato modificato tacitamente. D1–D6 devono essere risolte; l'approvazione del piano non risolve da sola una scelta D6 ambigua.
- Una run congela input e dataset; tutte le politiche ricevono identiche richieste e fisica. Versioni/seed/hash in ogni export.
- Ogni persona/richiesta pesa esattamente 80 kg; stesso valore in domanda, imbarco e pianificazione, con margine ρ=0,96 invariato. Nessun input operativo per distribuzione del peso o riserva separata.
- Niente 3D, dati hardcoded, miglioramento garantito, servizi a pagamento o deployment pubblico senza autorizzazione separata.
- Test fondamentali prima dei layer visuali; WCAG AA, tastiera, 320 px, zoom 200% e reduced motion sono accettazione, non rifiniture facoltative.
- Node 24.x disponibile (24.19.0) e npm 11.9.0 rilevati; controllare engine/peer/licenze reali prima dell'installazione e fissare manifest/lockfile. Nessuna installazione eseguita in questa Fase A.

## Focus di revisione

1. Cambio N: uffici fuori range e piano 0 devono essere segnalati senza perdere/modificare dati.
2. Peso/capienza: rifiuto, sbarco e retry non devono violare Q/C o produrre loop allo stesso timestamp.
3. Fine orizzonte/campione vuoto: incomplete visibili e statistiche null, nessun NaN o falso zero.
4. Rerun/cancel: messaggi tardivi e risultati del draft precedente non devono contaminare la run corrente.
5. Replay/riduzione movimento: seek, velocità e accessibilità non alterano trace, decisioni o KPI.

## Gate 0 — autorizzazione e contratto scientifico

**Owner:** responsabile + matematico, prima di qualunque codice prodotto.

- [x] Registrare l'approvazione di D1–D5 e della direzione UX/motion, con massa fissa di 80 kg richiesta dall'utente.
- [x] Completare la specifica supplementare D6 autorizzata per Q_e/C_e indipendenti, massa 80 kg e grouping eterogeneo, inclusi riduzione omogenea e casi limite.
- [x] Ottenere l'approvazione della nuova formulazione D6 prima di implementarla, con chiarimento sull'origine di q_e e confrontabilità dei conteggi. Nessuna riduzione del brief a capacità comuni è approvata.
- [ ] Fissare `modelVersion`, semantica dei timer/retry/riserve, KPI e condizioni valide per N=1; distinguere profilo originale e modello prodotto approvato.
- [ ] Definire fixture a mano per sbarco prioritario, riserva idle, limite grouping e fine orizzonte. Ogni aspettativa ha fonte o decisione approvata, non nasce dal codice che dovrà testare.

**Esito verificabile:** nessuna decisione scientifica necessaria all'engine rimane implicita. Questo gate può comportare soltanto ulteriore progettazione; non equivale all'avvio automatico della Fase B.

## Task 1 — base applicativa e contratto dello scenario

**Files futuri:** `package.json`, lockfile, `vite.config.ts`, `tsconfig.json`, `.gitignore`, `src/model/contracts.ts`, `src/model/validate.ts`, `tests/model/scenario.test.ts`.
**Owner:** Web Architect / implementer. **Produce:** i tipi dell'architettura e `validateScenario(input: unknown): {ok:true; scenario:ScenarioV2} | {ok:false; issues:Issue[]}`.

- [ ] Testare prima interi m/N, NaN/Infinity, Q/C/velocità/accelerazione/unità, ID uffici duplicati, dipendenti e piano; accettare gli estremi m=1/8, N=1/50 con 0 presente.
- [ ] Verificare massa 80 kg costante e import di dataset: peso diverso da 80 non entra nel profilo V2 senza migrazione esplicita/versionata; con Q=1000/C=13 la capienza fisica è 12.
- [ ] Testare distribuzione esplicita: totali derivati dagli uffici; ridurre N non sposta né cancella gli uffici fuori intervallo. Verificare capienze secondo la D6 scelta.
- [ ] Solo dopo autorizzazione: verificare compatibilità/licenze, installare lo stack minimo, fissare i lock e normalizzare scenario senza coercizioni nascoste.
- [ ] Verificare typecheck e `npx vitest run tests/model/scenario.test.ts`; nessun errore e tutti i casi previsti effettivamente eseguiti.

## Task 2 — fisica, domanda e numerica di riferimento

**Files futuri:** `reference/source/`, `tests/oracle/manifest.json`, `tests/oracle/fixtures/`, `src/model/physics.ts`, `numerics.ts`, `officeModel.ts`, `demand.ts`, `tests/model/physics.test.ts`, `numerics.test.ts`, `demand.test.ts`.
**Owner:** implementer con matematico sui contratti numerici. **Consuma:** ScenarioV2 validato. **Produce:** Dataset immutabili e SimulationContext con stime per ufficio; moduli testabili senza DOM.

- [ ] Conservare fonti immutabili e versioni audit; creare fixture OD esportabili, distinte dalle aspettative del profilo corretto.
- [ ] Testare `travelSeconds(from:Floor,to:Floor,physical:Physical):Seconds`: nel caso fonte 0 piani→0 s, 1→3,63318042491699 s, 2→5,14 s, 15→22,3 s; alla soglia δ=6,25 m→5 s, con continuità ai due lati.
- [ ] Per la fisica usare inizialmente tolleranza assoluta 10⁻⁹ s sulle fixture float64; documentare le tolleranze separate della numerica prima di usarle. Nessuna tolleranza permette conteggi o decisioni discordanti.
- [ ] Testare fit e previsione contro SciPy: probabilità finite, domanda non negativa, shrinkage senza osservazioni, NNLS β≥0, R² null con varianza nulla, percentili lineari e CI soltanto con campione idoneo.
- [ ] Testare riproducibilità seed+generatorVersion, massa 80 kg costante, coppia pranzo/ritorno, clipping degli orari, bias interno dichiarato, N=1 senza origini=destinazioni, training/holdout disgiunti e hash della serializzazione canonica. Le fixture originali migrate a 80 kg conservano tempi/OD e acquisiscono nuovo hash; il browser non consuma draw fittizi del peso.
- [ ] Verificare `npx vitest run tests/model`; confrontare fixture sul medesimo corpus OD. Esportare la domanda completa, così il replay di un dataset non dipende dal mantenimento futuro del PRNG.

## Task 3 — DES, tre politiche, KPI e trace

**Files futuri:** `src/engine/eventQueue.ts`, `simulate.ts`, `policies/fifo.ts`, `policies/greedy.ts`, `policies/adaptive.ts`, `tests/engine/events.test.ts`, `capacity.test.ts`, `policies.test.ts`, `metrics.test.ts`.
**Owner:** implementer; revisione del matematico sulle sole correzioni e dipendenze numeriche interessate.
**Interfaccia:** `simulate(scenario:ScenarioV2,dataset:Dataset,policy:PolicyId,context:SimulationContext,traceEnabled:boolean):PolicyResult`.

- [ ] Scrivere casi piccoli con aspettative verificabili: cabina iniziale 0, heap a pari tempo con contatore, segmento non deviabile, sbarco prima di pickup, porte per fermata, retry e evento obsoleto.
- [ ] Coprire Q_e/C_e al limite con massa 80 kg, carichi individuali distinti, passeggero fisicamente non trasportabile vs cabina solo non pianificabile per ρ, unica idle riservata, capacità pianificabile zero, fallback e massimo grouping secondo D3/D6. Nessun retry infinito a tempo invariato. La massa reale maggiore della riserva è soltanto caso archivistico del modello originale, non del profilo V2 a peso fisso.
- [ ] Verificare B/G eterogenea e riduzione omogenea; limite di tre target per decisione inclusi target senza movimento/fallback, escludendo KEEP e PARK pregressi. Nessuna asserzione di cap cumulativo o di presenza fisica.
- [ ] Coprire zero completamenti, una richiesta oltre termine, WAIT/ONBOARD finali, generated=completed+unfinished e pickedUp=completed+onboard; W/R/T non negativi e null quando mancanti.
- [ ] Implementare le sole semantiche approvate. Trace iniziale/delta, stato e outcome delle richieste sono output del motore, non ricostruzioni grafiche dai KPI.
- [ ] Verificare `npx vitest run tests/engine`; per tutte le politiche il datasetHash deve essere identico. Fixture corrette e benchmark archivistico restano chiaramente distinti.

## Task 4 — worker, configuratore e controllo run

**Files futuri:** `src/worker/protocol.ts`, `simulation.worker.ts`, `src/app/RunController.ts`, `src/features/scenario/`, `tests/worker/controller.test.ts`, `tests/e2e/configurator.spec.ts`.
**Owner:** Web Architect / implementer. **Consuma:** simulate e contratti. **Produce:** `runExperiment(scenario,policies,traceFor):ExperimentResult` nel worker e stati UI bozza/run/output.

- [ ] Testare RUN/DONE/ERROR/CANCEL, jobId vecchio, annullamento seguito da rerun, input errato, memoria/risorse esaurite e fit diagnostico non disponibile.
- [ ] Collegare ogni input operativo al suo valore normalizzato; rendere visibili unità, piano 0, lista uffici risolta e capacità individuali. Le chiavi inattive sono solo metadati di provenienza; la tabella delle capacità è derivata nel worker e invalidata quando cambia lo scenario.
- [ ] Prevedere lavoro a batch con yield per ricevere messaggi di annullamento; terminare il worker se necessario. Nessun cancel converte dati parziali in un confronto concluso.
- [ ] Usare progressi effettivi o stato indeterminato; mantenere gli input e marcare i risultati precedenti quando cambia la bozza.
- [ ] Verificare suite controller e Playwright del configuratore; l'interfaccia deve restare utilizzabile durante il calcolo.

## Task 5 — landing e «Gli algoritmi»

**Files futuri:** `src/app/routes.tsx`, `src/pages/LandingPage.tsx`, `AlgorithmsPage.tsx`, `src/content/modelCatalogue.ts`, `src/styles/tokens.css`, `src/components/Equation.tsx`, `tests/e2e/navigation.spec.ts`.
**Owner:** implementer frontend con designer; motion specialist soltanto per le sequenze concordate.

- [ ] Implementare le otto sezioni e la navigazione visibile «Gli algoritmi»; riportare formule/variabili/unità con equationId e fonte, distinguendo correzioni approvate e MPC non implementato.
- [ ] Collegare formule, codeRef e campi output; evitare numeri narrativi fissi provenienti da grafici di un altro scenario.
- [ ] Tradurre i token e i wireframe approvati; verificare licenze e comprimere/localizzare solo gli asset scelti. KaTeX e pagina tecnica caricate per route, font con fallback immediato.
- [ ] Applicare motion controllata e cleanup; testi/azioni non dipendono dai reveal. CSR ha fallback noscript informativo, senza promessa di sito completo senza JS.
- [ ] Verificare route profonda/reload, focus, ancore, menu mobile, formule, reduced motion e assenza di trigger che avviano run allo scroll.

## Task 6 — risultati, spiegazioni e replay verificabile

**Files futuri:** `src/features/results/`, `src/features/replay/`, `src/components/charts/`, `tests/results/aggregation.test.ts`, `tests/replay/replay.test.ts`, `tests/e2e/results.spec.ts`.
**Owner:** implementer con designer/motion per la sola visualizzazione. **Consuma:** ExperimentResult, outcomes e trace autentico.

- [ ] Testare CDF, aggregazione per fascia/piano d'origine, media dei KPI giornalieri distinta dai pooled, baseline zero e confronto con diversa percentuale di completamento.
- [ ] Costruire KPI/grafici/tabella dallo stesso output; titolo, unità, legenda, campione e spiegazione accompagnano ogni grafico. Mostrare anche regressioni o risultati invariati.
- [ ] Usare delta appaiati per le repliche; eventuale CI per adaptive richiede metodo dichiarato e verifica, non eredita il solo CI fifo−optimal della fonte.
- [ ] Implementare replay soltanto dopo validazione del trace: pausa, passo, seek e velocità devono ricostruire il medesimo stato senza cambiare KPI. Interpolazione dichiarata grafica.
- [ ] In reduced motion usare stati statici per evento e tabella, senza loop automatico. Verificare `npx vitest run tests/results tests/replay` e gli E2E risultati.

## Task 7 — accettazione e consegna della futura Fase B

**Files futuri:** `tests/acceptance/`, `tests/e2e/`, `docs/VALIDAZIONE.md` e script verifiche nel manifest.
**Owner:** responsabile; reviewer soltanto se emergono criticità sostanziali ancora irrisolte.

- [ ] Verificare tutte le 400 combinazioni geometriche m=1…8/N=1…50 con fixture piccole e gli invarianti; poi scenari di carico rappresentativi agli estremi e caso riferimento. Non eseguire indiscriminatamente 24 giornate lunghe per ogni combinazione.
- [ ] Misurare limiti di persone/repliche/trace sul dispositivo target; dichiarare budget risorse senza alterare matematica o escludere gli estremi geometrici validi. Registrare i target prestazionali come misure, non promesse.
- [ ] Verificare desktop/tablet/smartphone, 320 px, zoom 200%, tastiera, contrasto sugli stati effettivi, equazioni e tabelle con lettore schermo; nessun lungo blocco del thread UI.
- [ ] Eseguire `npm run typecheck`, `npm test`, `npm run test:e2e`, `npm run build`; gli script verranno creati in Task 1. Distinguere passati, falliti, saltati e non eseguiti.
- [ ] Salvare report numerico con fixture/hash/versioni, casi limite, limiti residui e istruzioni ripetibili. Preparare preview interna verificabile; il deployment pubblico conserva il gate separato.

## Stato della pianificazione

Alla stesura della Fase A le checkbox descrivevano lavoro futuro e l’unica esecuzione era l’audit invariato dell’allegato. La successiva Fase B ha creato i moduli e gli script; i controlli effettivamente eseguiti, i nomi dei file e i limiti residui sono registrati in VALIDAZIONE.md. L’audit archivistico resta distinto dai nuovi risultati fixed80.

Sequenza necessaria: Gate 0 → contratti/fisica → engine → worker e configuratore → risultati. La landing e la pagina tecnica possono avanzare in parallelo soltanto dopo la stabilizzazione del catalogo matematico; il replay dipende dall'engine e dal trace. UX/motion non ricalcolano il modello. L'ownership dei file viene assegnata prima di ogni delega implementativa.

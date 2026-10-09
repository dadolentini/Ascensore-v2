# Esecuzione — piano docs/PIANO-SVILUPPO.md

9 ottobre 2026, ramo locale `feat/ascensori-v2`. Fase B autorizzata dopo il chiarimento q_e/D_f. Nessun deployment pubblico autorizzato.

Ruling: q_e è un lotto di chiamate equivalenti per decisione, D_f è domanda attesa nella finestra L=3/H=12 minuti. La sottrazione usa conteggi confrontabili assumendo una chiamata individuale per viaggio; 0,82 resta un'ipotesi euristica della fonte senza calibrazione empirica di throughput. La funzione G non è un risparmio di attesa misurato.
Ruling: ownership disgiunta consente modello, motore e landing in parallelo dopo il contratto condiviso. Nessun agente modifica autonomamente i contratti o altri moduli; integrazione e modifiche ai confini spettano al responsabile.
Ruling: usare il checkout cloud isolato e un ramo locale; nessun worktree aggiuntivo, push, servizio a pagamento o libreria 3D.

| Attività | Produce / consuma | Ownership e stato |
| --- | --- | --- |
| Gate 0 / base | Autorizzazione e contratti → tutte le attività | Root; completato |
| Modello/numerica | Dataset, fit, forecast, capienze → engine e runner | implementation_model + integrazione Root; completato |
| Motore DES | Scenario/dataset/context → risultati e trace | implementation_engine + verifica Root; completato |
| Landing/algoritmi | Catalogo matematico → spiegazioni e navigazione | implementation_frontend + integrazione Root; completato |
| Runner/worker | Modello+DES → job immutabile/cancel/output | implementation_worker + Root; completato |
| Configuratore/risultati | Scenario → run → KPI, grafici, replay | Root; completato |
| Accettazione | Tutte le parti → evidenza numerica/E2E/build | Root; report in VALIDAZIONE.md |

Controllo dei confini: Task 1/2 condividono ScenarioV2 validato; Task 2/3 condividono travelSeconds, capacityByCar e floorDemand; Task 3/4 condividono PolicyResult; Task 4/6 condividono ExperimentResult; Task 5/6 condividono Equation e design token. Le firme sono in src/model/contracts.ts. Gli stati non sono ricalcolati dalla UI.

Compatibilità rilevata: Node 24.19.0, npm/npx 11.9.0; React 19.3.0, Vite 8.3.4, plugin-react 6.1.2, Vitest 5.0.3 soddisfano engine/peer. KaTeX 0.19.0; jStat 1.9.6 per CDF e Student t. Nessun framework preesistente in V2. Cache npm locale perché la cache home non è scrivibile; @types/jstat non esiste, declaration locale limitata alle API utilizzate.

Integrazioni successive recepite: landing più esplicativa senza formule, pagina autonoma «Come funziona» dal concreto al tecnico, esempio calcolato con timeline/carichi/decisioni, PDF originale apribile. Il simulatore consente run ripetute senza reload, annullamento, input avanzati espliciti, risultati precedenti identificati, export e replay. I grafici comprendono CDF, piano e fascia oraria con campioni e incompleti.

Correzioni emerse nelle verifiche: nomi accessibili dei campi, contrasti su superfici scure, tabelle scrollabili raggiungibili, attributi numerici vuoti senza NaN, seed non valido senza eccezione BigInt, intestazione di caricamento mobile con ritorno a capo. Il limite del runtime ha fermato i subagenti; Root ha completato integrazione e controlli senza attribuire loro una review indipendente conclusa.

Evidenza e limiti: [VALIDAZIONE.md](VALIDAZIONE.md). Bozza cloud `install_script` / `start_skill` salvata, distinta da pubblicazione dell’ambiente e del sito. Modifiche locali, nessun push automatico.

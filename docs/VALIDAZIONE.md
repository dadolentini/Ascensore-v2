# Validazione dell’implementazione V2

9 ottobre 2026 — ramo locale `feat/ascensori-v2`, repository esclusivo `dadolentini/Ascensore-v2`. Fase B autorizzata dall’utente dopo il chiarimento q_e/D_f. Nessun push o deployment pubblico.

## Prodotto realizzato

Landing editoriale 2D con spiegazioni semplici e scrolling nativo; movimenti SVG illustrativi seguono lo scroll desktop, con fallback statico su mobile, reduced motion e browser senza scroll timeline. I movimenti narrativi non vengono presentati come simulazione. Nessuna scena 3D o libreria di scrolling aggiuntiva.

`/come-funziona` accompagna dalla chiamata alle decisioni e alle misure. Il caso interattivo esegue il motore reale su richieste dichiarate: timeline attesa/viaggio, carichi in kg, assegnazioni e replay per eventi. Il passaggio alle equazioni è facoltativo; `/gli-algoritmi` contiene formule autentiche, unità, vincoli, provenienza e collegamenti al codice. Il PDF originale è apribile nelle pagine e nel footer.

Il configuratore principale separa edificio e persone dalle opzioni avanzate. La distribuzione degli uffici viene applicata da un’azione esplicita. Ogni run congela la configurazione e usa un corpus condiviso fra le tre politiche. Si possono modificare input, rieseguire e annullare senza reload; la navigazione conserva la bozza e gli ultimi risultati. I risultati precedenti sono marcati quando la bozza cambia. Ogni job crea un worker nuovo e lo termina alla conclusione, all’errore o all’annullamento; i messaggi tardivi vengono ignorati.

## Evidenza eseguita

| Controllo | Esito |
| --- | --- |
| Node / npm / npx | 24.19.0 / 11.9.0 / 11.9.0 |
| `npm ci`, `npm ls --depth=0` | Completati, nessun conflitto di dipendenze o peer |
| Chromium Playwright | Installazione e ripetizione completate |
| Vitest | 116 test, 15 file; nessun test disabilitato |
| Playwright | 6 test completati in Chromium |
| TypeScript e `npm run build` | Completati senza errori o avvisi di chunk troppo grandi |
| Integrità delle fonti | 19 file e PDF/JSON pubblici verificati per dimensione e SHA-256/byte |

I test numerici confrontano cinematica, CDF, quantili, intervalli Student t, shrinkage, forecast e un NNLS non banale con fixture Python/NumPy/SciPy. Le tolleranze sono in `tests/oracle/fixture-numeriche.json`; le decisioni e i conteggi interi non ammettono differenze. Il generatore browser è versionato separatamente: non si promette un corpus identico a NumPy per lo stesso numero di seed.

DES: segmenti già avviati, soste raggruppate, sbarchi prioritari, kg/posti individuali, timer idle, riserva, grouping per decisione, retry e fine orizzonte sono coperti da casi piccoli verificabili. Le 400 combinazioni m=1…8/N=1…50 sono eseguite con traffico piccolo. Altri tre casi densi, 120 richieste ciascuno, verificano tutte le politiche agli estremi 1/50, 8/1 e 8/50. Non si afferma di aver testato ogni distribuzione e ogni carico possibile.

I test browser verificano quattro run consecutive nello stesso documento, cambi degli input, conservazione delle bozze, corpus identico cambiando soltanto la flotta, nuova domanda cambiando le persone, più repliche, input vuoto e annullamento seguito da nuova run. Verificano anche due casi consecutivi in Come funziona, route profonde, apertura del PDF, MathML, menu e tastiera a 320 px, reduced motion e assenza di errori JavaScript. Axe controlla WCAG 2 A/AA e 2.1 AA sulle tre pagine e sui risultati effettivamente calcolati; le tabelle scorribili sono raggiungibili da tastiera.

Controllo visuale interno su desktop 1440 px e layout 320/768/1024 px. Un testo del fallback di caricamento poteva allargare la pagina mobile: ora va a capo. Le formule e le tabelle scorrono nel proprio contenitore. Non è stata eseguita una sessione completa con lettore schermo umano, zoom browser al 200%, Safari/Firefox o dispositivo mobile fisico: i test automatici non equivalgono a queste verifiche.

## Riferimento fixed80, calcolato

4 cabine, 15 piani sopra terra + terra 0, 30 uffici, 525 persone, 8 seed, 24 run. Tutte le politiche completano 14.850 richieste sullo stesso insieme di otto corpus. Le statistiche sotto sono medie non ponderate delle giornate, non numeri incorporati nel prodotto.

| Politica | Attesa media | Media dei p95 giornalieri | Viaggio medio |
| --- | --- | --- | --- |
| Baseline euristica `fifo` | 84,334 s | 455,803 s | 103,118 s |
| Greedy `optimal` | 8,687 s | 21,746 s | 26,896 s |
| Parking uffici `adaptive` | 9,538 s | 22,077 s | 27,636 s |

L’adattiva peggiora l’attesa rispetto al greedy in questo campione; il prodotto lo mostra senza correggere artificialmente il risultato. Baseline→greedy cambia dispatch e parking; greedy→adattiva cambia parking. Nessuna conclusione universale o validazione su un impianto reale.

Dati, seed e hash: [reference-summary.json](validation/reference-summary.json), rigenerati da `tests/acceptance/reference.test.ts`. Una run mantiene 19.754 eventi nel trace. La prova nel browser cloud ha completato il confronto in circa 8,7 s, con un worker creato e terminato; il task più lungo osservato sul thread principale è 92 ms. È una misura indicativa dell’ambiente headless corrente, con attività di verifica concorrente; non un benchmark di telefono o un limite promesso. Non sono state misurate prestazioni ai massimali delle risorse. La motion narrativa è CSS e il DES vive nel worker.

## Limiti scientifici e operativi dichiarati

- Massa reale e di pianificazione fisse 80 kg, margine 0,96; capienza pianificabile zero produce richieste non servite e KPI temporali null.
- q_e è copertura equivalente per decisione e D_f un conteggio futuro di chiamate individuali. Il fattore 0,82 viene dalla fonte; confrontabilità dimensionale e riduzione omogenea sono verificate, throughput in 12 minuti e beneficio del parking non sono calibrati empiricamente.
- `optimal` è greedy locale, `fifo` baseline euristica; niente FIFO stretto, ottimo globale, MPC implementato o controllo hardware implicito.
- Il DES parte all’inizio dell’orizzonte con cabine vuote al piano 0 e termina senza drain. Le statistiche sui passeggeri completati, gli incompleti WAIT/ONBOARD e i contatori della flotta hanno denominatori distinti.
- NNLS è diagnostica; il forecast degli uffici usa training/holdout disgiunti. La previsione conserva le ipotesi sintetiche e il clipping/bias dichiarati della fonte.
- Budget ingegneristici: 5.000 persone, 25.000 chiamate/giorno, 500.000 richieste conservative per corpus, 192 run, 20.000 bin fit; DES massimo 1.000.000 eventi, trace 32 MiB/150.000 eventi. Superamento = errore esplicito, senza ridurre domanda, seed o trace tacitamente. Non sono limiti di validità matematici né garanzie di performance.
- Gli originali, inclusi risultati a pesi variabili, sono in `reference/source/`; le fixture e i risultati V2 rimangono distinti. Grafici e KPI dell’applicazione sono ricalcolati a ogni esperimento.

## Ambiente e consegna

Stack verificato React 19.3.0, Vite 8.3.4, TypeScript 7.0.2, KaTeX 0.19.0, jStat 1.9.6; manifest e lockfile fissati. Font e asset locali; licenze/provenienza in [ASSET.md](sources/ASSET.md). KaTeX e le pagine informative sono lazy; bundle iniziale circa 350,6 kB / 110,3 kB gzip, worker 89,7 kB, nessuna libreria 3D o charting ridondante.

La bozza cloud ha salvato **install_script**, **start_skill** e la membership **repositories**, dopo la scoperta completa dei due checkout. Ascensore-v2 è registrato con il suo percorso e HEAD effettivi; il checkout precedente è conservato senza modifiche e le istruzioni limitano il lavoro a V2. Sono indicati `npm ci`, Chromium, verifiche e avvio Vite. La directory vuota `/workspace/.git` è un contenitore privo di metadata Git, non un terzo progetto. Il salvataggio non esegue né pubblica quella configurazione. Per attivarla nelle attività future, rivedere e salvare nelle impostazioni dell’ambiente e pubblicare l’ambiente preparato: è distinto dal deployment pubblico del sito. Le modifiche applicative restano locali e non sono riprodotte dal solo clone dell’attuale commit remoto. Non è stata verificata la riapertura in una nuova macchina cloud.

I quattro specialisti hanno svolto la progettazione e la delega implementativa è stata selettiva. Il limite del runtime ha poi interrotto i subagenti: integrazione e verifiche finali sono state completate dal responsabile. Non viene dichiarata una revisione indipendente conclusa del nuovo motore.

# Diagnosi del simulatore — 11 ottobre 2026

Verifica iniziale del sito pubblico `https://davidelentini.it/elevator/`, corrispondente al commit `acb2500` (codice applicativo `64a32e5`). Richiesta: capire perché un confronto non parte oppure sembra ripetere il precedente. Le osservazioni seguenti descrivono quella versione; le correzioni autorizzate successivamente e la revisione finale sono registrate in fondo. Nessuna nuova pubblicazione in questa attività.

## Scenario indicato dall’utente: rallentamento confermato

Safari su Mac; 30 piani sopra terra, 4 ascensori, 3 uffici per piano, 20 persone per ufficio. Dopo l’applicazione della distribuzione sono 90 uffici e 1.800 persone, tutte partecipanti al pranzo. Con le otto giornate iniziali il confronto comprende 24 simulazioni, oltre alle giornate per stimare e verificare le abitudini.

Riprodotto sul sito online con Chromium: il Web Worker riceve la configurazione corretta, prepara i dati e avvia la prima simulazione. Dopo 120 secondi non ha ancora completato la prima: la pagina indica «Simulazioni completate: 0 di 24». Nessun errore JavaScript o di validazione; il processo di calcolo occupa circa un core. La prova è stata annullata dal pulsante del sito al termine dell’osservazione. Non è stato misurato il tempo necessario a completare tutte le 24 simulazioni.

Questo comportamento spiega un avvio apparentemente fermo anche con dati validi. Non è esclusivo di Safari. Gli attuali limiti di richieste/persone proteggono alcuni budget di memoria, ma non garantiscono tempi di risposta adeguati.

### Collo di bottiglia individuato

Profilazione isolata di 20 secondi del codice originale del motore, eseguito in un Web Worker Node con lo stesso edificio e la politica iniziale `fifo`:

- Circa il 78% dei campioni attraversa `retryAll`, che rivaluta le richieste bloccate quando cambia lo stato delle cabine.
- Circa il 51% attraversa la costruzione di `stateSignature`, inclusa nel dato precedente: la descrizione della stessa flotta viene ricostruita per ogni richiesta bloccata, anche quando il tentativo precedente non ha modificato alcuna cabina.
- Sono presenti anche il costo di `chooseAssignment` e `evaluateRoute`, che provano le possibili inserzioni nelle fermate pianificate.

Riferimenti: `src/engine/simulator.ts:69`, `src/engine/simulator.ts:92`, `src/engine/routing.ts:69`. Sono misure diagnostiche del software, non metriche matematiche del servizio ascensori. I tempi dipendono dalla macchina e dal browser.

Un esperimento su una copia generata fuori dal repository riutilizza la firma durante `retryAll` e la ricalcola dopo un’assegnazione riuscita. In quella prova la prima simulazione termina entro la finestra di 30 secondi. Questo sostiene la diagnosi, ma non certifica ancora equivalenza numerica completa o prestazioni del confronto completo: l’esperimento non è una correzione applicata al sito.

In aggiunta, `src/worker/runner.ts:116` esegue ciascuna simulazione sincrona e invia un progresso soltanto dopo il suo completamento. Per questo il contatore può restare a zero per molto tempo pur essendo il motore in esecuzione.

## Secondo difetto: nuovo tentativo non valido e vecchio messaggio di completamento

1. Eseguire il confronto iniziale: 15 piani sopra terra, 4 ascensori, 30 uffici, 525 persone, 8 giornate, pranzo al 100%.
2. Cambiare soltanto «Piani sopra terra» da 15 a 3.
3. Premere «Esegui il confronto».

Il nuovo confronto non viene avviato: la lista conserva gli uffici sui piani da 4 a 15. La validazione segnala correttamente gli uffici fuori dall’edificio. L’interfaccia però conserva il messaggio «Confronto completato. I risultati sono disponibili qui sotto.» insieme ai tre risultati precedenti. Il risultato precedente è accompagnato da un avviso, ma il messaggio di completamento è incoerente con l’ultimo tentativo.

La registrazione dei messaggi del Web Worker conferma che al secondo clic non parte alcun nuovo lavoro. Non è stato riprodotto un ciclo infinito del motore.

### Origine nel codice

- `src/features/Simulator.tsx:58`: cambiare i piani aggiorna il numero di livelli, conservando gli uffici e senza impostare `pendingDistribution`.
- `src/model/validate.ts:73`: impedisce correttamente uffici oltre l’ultimo piano.
- `src/features/Simulator.tsx:46`: la validazione interrompe l’avvio prima di `job.start`; aggiunge gli errori del modulo, ma non cambia lo stato dell’ultimo lavoro.
- `src/features/Simulator.tsx:67`: il messaggio di completamento dipende da `job.status === 'done'`, senza considerare gli errori del nuovo tentativo.
- `src/features/Simulator.tsx:70`: i risultati precedenti restano visibili finché non parte un nuovo calcolo.

Inoltre i valori guida iniziali «2 uffici per piano» e «16 persone per ufficio» descrivono una possibile nuova distribuzione uniforme, non la lista iniziale di 525 persone. La distinzione è spiegata nel testo, ma il flusso può far pensare che i valori siano già applicati.

## Verifiche effettuate sul sito online

| Prova | Riscontro |
| --- | --- |
| Preset iniziale completo, pranzo 100% | Terminato in circa 9,6 secondi nell’ambiente di prova: 8 giornate, 24 risultati, nessun errore JavaScript. Il tempo non è una promessa per altri dispositivi. |
| Scenario utente: 30 piani, 4 ascensori, 90 uffici, 1.800 persone | Sia Chromium sia WebKit restano a 0 di 24 dopo 120 secondi; avvio e preparazione confermati; prove annullate dal pulsante del sito. |
| Riduzione dei soli piani da 15 a 3 | Avvio bloccato; uffici fuori edificio; messaggio di completamento e risultati precedenti conservati. |
| Applicazione esplicita di 3 piani, 1 ufficio per piano, 2 persone per ufficio | Nuovo lavoro concluso: 3 uffici, 6 persone, 3 risultati per una giornata. |
| Successivo passaggio da 4 a 1 ascensore | Altro lavoro concluso nello stesso documento, con la nuova flotta. |
| Quattro test di regressione esistenti contro il sito pubblico | 4 superati in 19,8 secondi: modifica del numero di ascensori, quattro confronti consecutivi, arresto e aggiornamento del replay, selezione delle giornate e azzeramento delle selezioni. |

I test verificano anche i dati JSON calcolati: cambiare le persone modifica il dataset; cambiare soltanto gli ascensori conserva la stessa domanda, ma modifica la flotta della simulazione. Ripetere configurazione e codici delle giornate identici produce intenzionalmente gli stessi risultati, come richiesto dalla riproducibilità.

## Correzione consigliata

- Ottimizzare le ricostruzioni e rivalutazioni ripetute, mantenendo identiche decisioni, tempi e dati. Verificare l’equivalenza numerica e le tracce prima di integrare una modifica del motore.
- Aggiungere un avanzamento interno alla singola simulazione, con notifiche limitate per frequenza; non cambiare il tempo simulato o la domanda per far apparire il calcolo più veloce.
- Validare esplicitamente anche la configurazione da 30 piani e 1.800 persone e definire un budget di lavoro realistico. Ridurre le giornate può ridurre il lavoro totale, ma non elimina il costo della prima simulazione.
- Distinguere nel messaggio di stato l’ultimo confronto concluso dal nuovo tentativo bloccato. Mostrare vicino all’avvio «Il nuovo confronto non è partito» e la causa, senza presentarlo come appena completato.
- Rendere esplicita l’azione richiesta quando i nuovi piani non contengono più gli uffici: applicare una nuova distribuzione oppure correggere la lista personalizzata. Non eliminare, spostare o ricreare silenziosamente gli uffici modificati dall’utente.
- Identificare chiaramente come precedenti i risultati conservati dopo un tentativo non valido.
- Aggiungere una regressione per la sequenza confronto riuscito → riduzione dei soli piani → tentativo bloccato → correzione → nuovo confronto, attualmente assente dalle prove esistenti.

## Limiti della diagnosi iniziale

Le prove sono state eseguite con Chromium desktop e viewport mobile. È stato inoltre avviato WebKit su Linux con librerie temporanee scaricate da Debian e checksum verificati: un confronto piccolo (3 piani, 6 persone, una giornata) si conclude in circa 0,3 secondi, mentre lo scenario dell’utente è ancora a 0 di 24 dopo 120 secondi. WebKit Linux non costituisce una verifica della versione effettiva di Safari sul Mac dell’utente. Non sono state modificate equazioni, dati autorevoli, dipendenze del progetto o sorgenti applicativi.

## Correzioni autorizzate e revisione generale

Su richiesta successiva dell’utente, quattro subagenti autentici hanno gestito separatamente performance del motore, protocollo Worker, interfaccia e validazione numerica indipendente. Il coordinatore ha letto e integrato le modifiche, eseguito la suite completa e verificato la build statica. Nessuna dipendenza aggiunta; modello, domanda, costi, ordine dei candidati, vincoli, seed e fonti autorevoli conservati.

Nel motore, la firma della flotta e le valutazioni del piano corrente sono riusate solamente nello stesso passaggio di rivalutazione e allo stesso tempo simulato; ogni assegnazione riuscita invalida la firma e la cache della cabina modificata. I buffer dei candidati riducono le allocazioni, conservando separatamente il piano vincente. Un candidato definitivamente non fattibile viene scartato prima, senza cambiare l’API di valutazione completa. La revisione verifica queste condizioni; 33 risultati completi congelati dal motore originale, con 36.257 eventi registrati, coincidono esattamente con il motore aggiornato. Provenienza e SHA-256 sono in `tests/oracle/simulation-equivalence/`.

Il progresso viene inviato anche durante la singola corsa, limitato a circa un messaggio ogni 150 ms. L’interfaccia mostra giornata, organizzazione, orario simulato ed eventi; il numero di simulazioni completate avanza soltanto al termine effettivo. Gli aggiornamenti frequenti di orario/eventi non vengono annunciati continuamente ai lettori di schermo. Il tempo simulato e le decisioni non dipendono dalle notifiche.

Un nuovo tentativo non valido mostra esplicitamente che il confronto non è partito. I risultati conservati sono etichettati come precedenti anche dopo annullamento o errore; gli uffici personalizzati non vengono spostati o eliminati. Gli errori di piano sono raggruppati, mantenendo il focus sul primo campo da correggere. Corretto inoltre il contenitore dei label nella tabella uffici, che causava overflow a 390 px.

### Limite della registrazione, distinto dal calcolo

La prova completa ha rivelato un ulteriore ostacolo: la registrazione della prima giornata con «Chiamate e previsione» supera il budget preesistente di 32 MiB. Il confronto ora recupera esclusivamente l’errore `unsupported/resource-trace` della corsa selezionata per la registrazione: scarta il tentativo e ripete quella stessa corsa con gli stessi dati, senza trace. Tutte le richieste, le giornate e le metriche restano calcolate; la mancanza del replay è dichiarata nell’interfaccia e nel JSON. I limiti restano invariati. Errori numerici, input non validi, limite eventi e altri errori continuano a interrompere il lavoro. Il test indipendente confronta anche il risultato recuperato con l’oracolo originale, non soltanto con il motore modificato.

### Riscontro finale

| Verifica eseguita dal coordinatore | Esito |
| --- | --- |
| `npm test` | 200 test in 20 file, zero fallimenti; inclusi 55 controlli indipendenti di equivalenza e recupero. |
| Chromium, suite browser completa | 22 test superati. |
| WebKit Linux, suite browser completa | 22 test superati. |
| Edificio utente, 90 uffici / 1.800 persone / pranzo 100% / 8 giornate | 24 risultati completi: circa 145,1 s Chromium, 227,4 s WebKit; registrazione indisponibile segnalata. |
| Confronto successivo nello stesso documento | Riuscito in entrambi i browser con 8 cabine e 180 persone; configurazione e dataset aggiornati, nessun reload. |
| KPI dei 24 risultati Chromium/WebKit | Identici campo per campo nel caso verificato. |
| TypeScript, build con `/elevator/`, preparazione Pages | Completati senza errori. |
| Controllo della build statica locale | Pagine e refresh, reindirizzamenti, PDF originale, asset/Worker, due confronti, esempio interattivo, download JSON/CSV e viewport 320 px superati. |

Evidenza sintetica delle due prove pesanti: `docs/validation/simulator-fix-2026-10-11.json`. Il controllo verifica la stessa domanda per le tre organizzazioni, massa di 80 kg e conservazione fra richieste completate, in attesa e a bordo. Le richieste non concluse entro le 21:00 restano tali: «confronto completato» significa calcolo concluso, non servizio riuscito per ogni persona.

I tempi sono misure dell’ambiente cloud, non garanzie per il Mac dell’utente. WebKit Linux verifica il motore del browser, non Safari su un Mac fisico. Non sono stati provati tutti i carichi possibili. La build verificata non viene pubblicata automaticamente dal push: il deployment resta manuale.

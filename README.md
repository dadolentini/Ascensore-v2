# Ascensori V2

Piattaforma React/TypeScript per studiare il modello DCS allegato: landing 2D, pagina interattiva **Come funziona**, **Gli algoritmi**, simulatore a eventi discreti e confronto di tre politiche sullo stesso corpus di richieste. Massa deterministica di **80 kg** per persona; piano terra **0** aggiuntivo ai piani sopra terra.

## Avvio

Node **24** e npm **11**, versioni verificate 24.19.0 / 11.9.0. Le dipendenze e i peer sono fissati nel lockfile; non servono backend, credenziali o servizi esterni.

```bash
cd /workspace/Ascensore-v2
npm ci
npm run dev -- --port 4173 --strictPort
```

Per i controlli:

```bash
npm test
PLAYWRIGHT_BROWSERS_PATH=/tmp/ascensori-v2-browsers npx playwright install chromium
PLAYWRIGHT_BROWSERS_PATH=/tmp/ascensori-v2-browsers npm run test:e2e
npm run build
```

`build` comprende il controllo TypeScript. `.npmrc` usa una cache locale scrivibile. Il browser Playwright è una risorsa di test, non una dipendenza scaricata dagli utenti del sito.

## Uso

- Configura piani, ascensori e persone; **Distribuisci gli uffici** applica esplicitamente la distribuzione dichiarata. Gli uffici preesistenti non vengono spostati tacitamente quando cambi i piani.
- Le opzioni avanzate espongono uffici individuali, pause, portata/posti per cabina, caratteristiche fisiche, orari e repliche.
- Esegui, modifica e riesegui senza reload. Puoi annullare e ripartire. Il worker viene terminato e sostituito a ogni run; i risultati precedenti rimangono identificati fino alla nuova conclusione. Navigare nelle altre pagine conserva bozza e risultati del simulatore.
- **Come funziona** calcola un caso controllato con lo stesso motore, timeline per persona, carico in kg, decisioni e replay. **Gli algoritmi** conduce a formule, unità, limiti e collegamenti al codice.
- Esporta configurazione, risultati completi JSON o KPI CSV. Seed, versione del generatore e SHA-256 del dataset rendono identificabile il corpus; non si promette identità con NumPy a parità di seed.

## Struttura

`src/model/` contiene contratti, validazione, domanda, fisica, apprendimento e numerica; `src/engine/` contiene routing, parking e DES; `src/worker/` esegue gli esperimenti; `src/features/` presenta configurazione, grafici e replay. UI e playback non decidono il dispatch.

Il PDF originale è in `public/model/rapporto_ascensori.pdf`, apribile dalla navigazione delle pagine informative e dal footer. `reference/source/` conserva i 19 file matematici originali senza modifiche; [manifest e provenienza](docs/sources/README.md) distinguono gli originali dalle estensioni approvate.

## Rigore e limiti

Dominio geometrico 1–8 cabine e 1–50 piani sopra terra. Con un solo piano i viaggi interni hanno probabilità 0. Capienze individuali, margine di pianificazione 0,96, orizzonte finito senza svuotamento delle code e richieste incomplete sono espliciti. Le medie e i percentili si riferiscono ai completati; campioni vuoti restituiscono `null`.

`fifo` è la baseline euristica sorgente, `optimal` un inserimento greedy locale, `adaptive` lo stesso dispatch con parking previsto dagli uffici. I nomi sorgente non indicano FIFO stretto né un ottimo globale. Risultati invariati o peggiori sono mostrati.

Il fattore 0,82 converte i posti pianificabili in un lotto equivalente di chiamate per decisione; è un’euristica documentata, **non throughput calibrato** nella finestra di 12 minuti. Il fit NNLS è diagnostico e non governa il parking. Non si tratta di una certificazione o di un controllo hardware.

I budget del browser sono distinti dai vincoli matematici: 5.000 persone, corpus conservativo 500.000 richieste, 25.000 richieste/giorno; trace massimo 32 MiB o 150.000 eventi. Il superamento interrompe l’esperimento con errore esplicito; nessun campionamento o risultato parziale viene presentato come concluso. Questi massimali non sono una garanzia di velocità su tutti i dispositivi.

Evidenza di verifica e limiti residui: [VALIDAZIONE.md](docs/VALIDAZIONE.md). Piano e specifiche: [docs/](docs/PROPOSTA-FASE-A.md). Nessun deployment pubblico viene eseguito dai comandi di setup.

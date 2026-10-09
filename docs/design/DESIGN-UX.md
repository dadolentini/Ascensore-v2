# Ascensori V2 — proposta design e UX, Fase A

> Fotografia della Fase A; l’implementazione e le integrazioni autorizzate sono documentate in [VALIDAZIONE.md](../VALIDAZIONE.md). D1–D6 e Fase B sono successivamente approvate; le note di autorizzazione iniziale sotto sono storiche.

## Intento e confini

- Landing premium, editoriale e contemporanea per capire il problema, configurare uno scenario e leggere risultati autentici.
- Proposta di progettazione: soltanto documenti e istruzioni di progetto nel repository; nessun codice prodotto o dipendenza installata.
- Destinazione: nuovo repository `dadolentini/Ascensore-v2`; il precedente `/workspace/Ascensori` resta fuori ambito.
- Otto sezioni in scroll nativo e pagina dedicata `/gli-algoritmi`, presente nella navigazione principale.
- Il caso narrativo a quattro cabine è un esempio dichiarato; il configuratore supporta il requisito 1–8 cabine e 1–50 piani sopra terra, oltre al piano 0.
- Formule, politiche e KPI devono seguire la verifica matematica; nessuna promessa di miglioramento prima di un confronto calcolato.

## Riferimenti visivi letti

- `17_44_44-1.png`: torre al crepuscolo; verticalità, silhouette leggibile e contrasto caldo/freddo. Immagine principale della hero.
- `17_38_51-3.png`: ingresso frontale; simmetria, trasparenza e soglia. Ritaglio secondario per introdurre persone e domanda.
- `17_44_48-4.png`: lobby; marmo, ottone e spazio libero. Ispira palette e ritmo, non un fondale ripetuto dietro ai dati.
- `17_44_50-5.png`: porta ascensore; metallo, dettagli e asse verticale. Inserto editoriale nella sezione sistema.
- I PNG sono riferimenti architettonici senza istruzioni testuali; non provano caratteristiche fisiche del sistema né proprietà di un edificio reale.
- Non ricostruire l'edificio: fotografia e SVG bidimensionali; niente camera, WebGL o percorso 3D.
- Uso delle immagini: soggetto conservato tramite crop responsivo e focal point; nessun testo piccolo sovrapposto alla fotografia.

## Direzioni considerate e scelta

- **Consigliata — editoriale architettonica:** fondo avorio, titoli serif, testo tecnico sans, immagini ampie e diagrammi fini. Collega i PNG a una lettura scientifica chiara.
- Alternativa: interfaccia tecnica scura dominante; utile ai grafici, ma rende secondaria la qualità architettonica richiesta.
- Alternativa: magazine fotografico dominante; espressivo, ma diluisce configurazione e prove. La proposta limita le immagini alle parti narrative.
- Una sezione matematica carbone crea contrasto nel ritmo; il simulatore torna chiaro per sostenere lettura, campi e confronto.

## Token e contrasto

| Token | Valore | Impiego | Contrasto verificato |
|---|---|---|---|
| `surface` | `#F5F1E8` | avorio principale | riferimento |
| `ink` | `#1D2428` | titoli, testo, CTA | 13,95:1 su surface |
| `muted` | `#5A6264` | testo secondario | 5,54:1 su surface |
| `brass` | `#8A613C` | accento, link sottolineati | 4,83:1 su surface; bianco 5,45:1 |
| `night` | `#121D25` | sezione matematica | surface 15,17:1 |
| `gold-light` | `#F3D9AB` | dettagli sulla sezione scura | 12,48:1 su night |
| `focus` | `#095A6A` | focus su fondi chiari | 6,95:1 su surface |
| `border` | `#7B807D` | bordi attivi di campi | 3,56:1 su surface |
| `chart-1/2/3` | `#25637D / #73569C / #32685A` | serie distinte | 5,90 / 5,26 / 5,71:1 su surface |

- Rapporti calcolati con luminanza sRGB WCAG; verificare di nuovo coppie effettive, hover, focus, disabled e trasparenze nell'implementazione.
- Focus: anello esterno 3 px con offset 3 px; su night usare gold-light. Oro chiaro non diventa testo sul fondo avorio.
- Serie dati: colore + tratteggio + nome; mai affidare significato o stato al solo colore.
- Display: **Instrument Serif**, fallback Georgia, 48–88 px desktop / 40–56 px mobile, interlinea almeno 1,06; niente serif sottile per testi minuti.
- Testo e controlli: **Manrope**, fallback system-ui, 18/28 px desktop, 16/25 px mobile; numeri tabulari per KPI, assi e tabelle.
- Microtitoli 12–14 px, peso 600 e tracking moderato; etichette e istruzioni rimangono in stile frase leggibile.
- Font da ospitare localmente in Fase B se approvati, con fallback immediato e licenza verificata; non bloccano lettura o layout.
- Spazi: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128 px; sezioni 96–128 px desktop, 64–80 px mobile.
- Container massimo 1440 px; 12 colonne/gap 24 desktop, 8/gap 20 tablet, 4/gap 16 mobile. Margini 16 px a 320 px, 20 px da 360 px.
- Superfici piatte, separatori sottili; raggi 4–8 px per controlli, grandi immagini senza effetto card; ombre solo per menu sovrapposti.

## Navigazione e wireframe desktop

- Header: marchio testuale Ascensori V2 a sinistra; link **Il sistema**, **Simulatore**, **Gli algoritmi**; CTA compatta **Configura uno scenario**.
- Header sobrio, altezza 72 px; skip link iniziale; ancore con offset se l'header resta sticky. Link attivo segnalato anche da sottolineatura.
- **01 Hero:** griglia 5/7; titolo «Il tempo, tra un piano e l'altro.» e spiegazione a sinistra, torre 4:5 a destra; CTA al simulatore e link agli algoritmi.
- Testo hero: «Esplora come domanda, capacità e politiche di assegnazione cambiano il servizio di un sistema di ascensori.» Nessun KPI promozionale.
- **02 Problema:** titolo e breve testo 4/8; sequenza visiva persone → chiamata → attesa → arrivo, senza tempi o percentuali fittizie; dettaglio ingresso laterale.
- **03 Sistema a quattro cabine:** diagramma SVG con cabine A–D, piano 0 e piano superiore; didascalia «Schema illustrativo — esempio a 4 cabine» sempre visibile.
- Qui si spiegano corsa, fermata, imbarco e capienza; il dettaglio porta è un inserto, senza fingere una telemetria dell'edificio.
- **04 Ottimizzazione:** tre colonne narrative sulle politiche, con ordine di lettura chiaro; titolo «Tre politiche, lo stesso scenario» e diagramma della scelta.
- Etichette proposte: «FIFO — baseline euristica», «Greedy sul costo J», «Adattiva — parking appreso»; nome interno `optimal` spiegato negli algoritmi.
- **05 Matematica:** fondo night, introduzione 5 colonne + formula verificata e legenda 7; testo DOM e link «Leggi il modello e le ipotesi».
- Formula verificata in [specifica matematica](../mathematics/SPECIFICA.md): `J = ΣWAIT [ETA_pick − now + (ζ/100) max(0, ETA_pick − born − w₀)²] + α Σresidual_ride`.
- Nel riquadro landing si evidenziano attesa prevista, penalità oltre soglia e viaggio residuo; la pagina algoritmi precisa WAIT: `ETA_drop − ETA_pick`, ONBOARD: `ETA_drop − now`.
- Default sorgente α=0,33, ζ=0,035, w₀=120 s, da associare alla configurazione corrente; J in secondi equivalenti e ΔJ usato nella scelta greedy.
- ETA è approssimativo, con divergenze sulle porte documentate dalla verifica; la formula non prova un ottimo globale e non certifica performance.
- **06 Decisioni:** composizione editoriale con domanda, capacità e distribuzione per piano; ogni fattore collega una scelta ai campi che influenzano il calcolo.
- **07 Simulatore:** configurazione 5 colonne + riepilogo/edificio 2D 7 colonne; pulsante «Esegui il confronto» esplicito, senza avvio allo scroll.
- **08 Risultati:** riepilogo scenario, KPI calcolati, grafici e tabella equivalente; sotto, limiti e collegamento agli algoritmi. Prima del run, stato vuoto utile.
- Footer: versione del modello/dati se disponibile, collegamento agli algoritmi e distinzione fra immagini illustrative e simulazione.

## Wireframe mobile e accessibilità

- Header 64 px: marchio e menu accessibile; «Gli algoritmi» resta una voce di primo livello, senza essere relegata al footer.
- Hero: titolo → spiegazione → CTA → foto; fotografia più corta, senza nascondere la torre con crop arbitrari.
- Sezioni 02–06 in una colonna: titolo, testo, diagramma o immagine; carte politiche impilate, nessuno swipe necessario per leggere.
- Simulatore: campi → riepilogo → azione → stato → risultati; niente pannello sticky che copra input, errori o tastiera.
- Edificio 2D: finestra di piani con piano 0 sempre rintracciabile, controllo esplicito del piano visibile; alternativa elenco/tabelle per 50 piani.
- Grafici con assi e unità leggibili: ridurre tick e densità, non il font; quando serve scorrimento orizzontale, avviso e tabella equivalente.
- Area interattiva almeno 44×44 px; zoom testo 200%, reflow a 320 px, tastiera e ordine focus coerenti; hamburger con focus restituito alla chiusura.
- Figure con descrizione e didascalia; foto decorative con alt vuoto, immagini informative con descrizione pertinente; formule accessibili anche come testo.
- Tooltip apribili tramite focus/tap; nessuna informazione disponibile solo al passaggio del mouse o durante l'animazione.

## Configuratore: contenuti e flusso

- Gruppo **Edificio**: «Ascensori» intero 1–8; «Piani sopra terra» intero 1–50; nota «Il piano terra 0 è incluso e non aumenta questo numero».
- In Fase B l'intero range, inclusi 1/8 cabine e 1/50 piani, è un criterio obbligatorio: lo stato «non supportato» non autorizza a disabilitare questi estremi.
- Gruppo **Uffici e persone**: righe con identificativo, piano e dipendenti; eventuali ora pranzo e partecipazione solo secondo il contratto matematico verificato.
- Distribuzione per piano derivata dalla somma degli uffici: mini barre, totale dipendenti e tabella; nessun secondo totale indipendente e contraddittorio.
- Preset uniformi o concentrati possono compilare uffici effettivi; una selezione puramente decorativa non soddisfa il requisito di distribuzione influente.
- Cambiare N non elimina uffici silenziosamente: elencare righe fuori intervallo e richiederne la correzione prima del run.
- Gruppo **Capacità**: `Q_e` in kg e `C_e` in persone per ciascuna cabina, secondo la [specifica supplementare D6](../mathematics/D6-CAPIENZE-INDIVIDUALI.md) da approvare; spiegare che il carico è limitato da entrambi. Un'azione «applica a tutte» può compilare gli stessi valori mantenendo i dati individuali.
- Aggiornamento approvato: nota persistente «80 kg per persona — massa fissa nel modello». La massa non è uno slider né una distribuzione regolabile; capacità fisica e pianificata sono derivate e distinte.
- Parametri fisici avanzati: v in m/s, a in m/s², h in m, porta/trasferimento in s; mostrarli soltanto se realmente collegati al motore.
- Gruppo **Confronto**: selezione delle politiche e impostazioni di riproducibilità validate; stesso scenario e dataset per tutte le politiche confrontate.
- Default da parametri validati, visibili nel riepilogo; nessun valore arbitrario scelto perché produce un grafico migliore.
- Numeric input e stepper con unità adiacente e label persistente; uno slider eventuale resta sincronizzato al campo numerico, mai unico controllo.
- Validazione durante il blur e all'invio: interi/intervalli, valori finiti e positivi ove richiesto, piano valido, uffici identificabili e coerenza domanda/capienza.
- Errori inline con testo concreto («Inserisci un intero tra 1 e 8»); riepilogo cliccabile all'invio e focus al primo campo errato.
- Un campo riferito a una capacità non supportata non viene presentato come operativo; spiegare il limite e conservare gli altri dati inseriti.
- Invio congela lo scenario: riepilogo di m, N+0, uffici/dipendenti, distribuzione, capienza e politiche accanto ai risultati della stessa run.
- Modifiche successive sono una bozza: i risultati restano etichettati «Scenario precedente — esegui per aggiornare», senza ricalcolo implicito o mescolamento.

## Stati e lettura dei risultati

- **Vuoto:** «Configura lo scenario ed esegui il confronto»; mostra struttura, unità e significato dei grafici, senza valori di esempio simili a KPI reali.
- **Caricamento:** stato annunciato con `aria-live`, pulsante occupato e input conservati; percentuale solo se il motore fornisce avanzamento misurabile.
- **Errore:** spiegazione utile e azione «Riprova»; input invariati, risultati precedenti marcati come precedenti. Gli errori tecnici estesi restano nei dettagli.
- **Non supportato:** indicare quale configurazione/funzione è fuori contratto e quali campi correggere; nessuna interpolazione di dati mancanti o risultato simulato in UI.
- **Parziale:** passeggeri completati e non completati entrambi visibili; una media delle attese sui soli serviti richiede esplicitazione del denominatore.
- KPI candidati verificati: servite/non completate, attesa media/mediana/p95 in s, quota attesa >120 s; altri indicatori nei dettagli e solo se disponibili.
- Nome politica, unità, popolazione osservata, orizzonte e versione/configurazione accompagnano i risultati; seed/repliche compaiono se garantiti dal contratto.
- Grafici consigliati: distribuzione/CDF delle attese e andamento per fascia oraria; barre per persone servite e carico, solo se la metrica è realmente esportata.
- Quantili non disponibili sono «Non disponibile», non zero; differenze percentuali richiedono baseline, denominatore e calcolo verificato.
- Incertezze e intervalli mostrati solo con repliche e metodo autentici; niente leaderboard, miglioramento garantito o vincitore prima dei risultati.
- Download di dati/immagini è una capacità da implementare e verificare in Fase B, non una promessa di funzioni già presenti negli allegati.
- Le figure PDF pregenerate possono diventare esempi documentali con origine e configurazione; non diventano i risultati del run dell'utente.
- Il motore allegato non esporta un trace: il replay reale richiede esportazione eventi autentici e validazione prima di diventare una UI operativa.
- Dopo tale integrazione: controlli **Avvia / Pausa / Passo**, tempo e legenda espliciti; interpolazione di posizione dichiarata grafica fra eventi validati.

## Pagina «Gli algoritmi»

- Header identico, voce nav attiva, breadcrumb «Home / Gli algoritmi» e sommario ad ancore visibile; mobile sommario apribile senza bloccare lo scroll.
- Introduzione: cosa confronta il modello, dove si applica e quali limiti conserva; distinguere teoria, codice allegato e adattamenti della Fase B.
- Ordine: parametri/unità → domanda dagli uffici → vincoli/tempi → tre politiche → funzione J → parking adattivo → metriche → riproducibilità/limiti/fonti.
- Ogni politica ha nome UI e nome sorgente, regola verificata, diagramma statico, assunzioni e limiti; `optimal` non implica soluzione globale esatta.
- Formula accessibile, legenda variabili con unità e collegamento alla fonte; spiegazione naturale accanto alla matematica, leggibile senza animazione.
- Distinguere modello uffici appreso offline dal comportamento adattivo durante il run; non suggerire training online inesistente.
- Fonti puntuali al materiale matematico e versione utilizzata; nessun numero estratto dai PDF viene riutilizzato senza verificarne l'origine.
- CTA finale «Prova uno scenario» conserva una bozza esistente se presente; navigazione avanti/indietro non perde campi o risultati.

## Coordinamento motion e criteri di approvazione

- Concordato con [ruolo motion](MOTION.md): scroll nativo, hero prevalentemente statica, nessun trapping/pin necessario, nessun avvio simulazione allo scroll.
- SVG narrativi dichiarati illustrativi; un grafico dei risultati compare direttamente con i valori reali, senza count-up o animazione che inventi il tempo di calcolo.
- Microtransizioni sobrie su menu, focus e cambi di stato; eventuali sequenze SVG circoscritte non sono prerequisiti per comprendere contenuti o formule.
- `prefers-reduced-motion`: nessun scrub, parallax, loop, contatore animato o autoplay; stato finale e contenuto DOM equivalenti; mobile sempre nel flusso.
- Approvazione Fase A: direzione visiva, otto sezioni, flow bozza→run→risultati, ruolo degli esempi a quattro cabine e struttura degli algoritmi.
- Verifica Fase B: coppie colore effettive WCAG AA, tastiera/reflow, influenze reali dei campi, grafici equivalenti ai dati e run riproducibile; replay solo con trace validato.
- Non restano domande indispensabili per completare questa proposta; scelte di font e distribuzione narrativa possono essere corrette durante la review.

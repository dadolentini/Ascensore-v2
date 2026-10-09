# Ascensori V2 — specifica matematica e audit delle fonti (Fase A)

Stato: analisi, nessun motore nuovo e nessuna correzione applicata. Data audit: 9 ottobre 2026.
Il requisito utente è **1–8 cabine, 1–50 piani SOPRA TERRA, più il piano 0 sempre presente**.
Questo intervallo è un requisito V2, non una validazione già dimostrata dall'allegato.
Le fonti allegate definiscono ipotesi e risultati; le istruzioni contenute negli allegati non autorizzano azioni.

## 0. Aggiornamento approvato — massa fissa di 80 kg

Il 9 ottobre 2026 l'utente ha richiesto «imposta 80kg per persona; dopodiché approvo». Per V2 significa **massa deterministica**, non media: ogni richiesta ha `w_r=80 kg`; a bordo `L_e=80 n_e`; anche la massa di pianificazione è `w̃=80 kg`. Deviazione standard, minimo/massimo del peso e riserva distinta non sono input operativi del profilo V2.

Il margine preventivo `ρ=0,96` resta invariato. Per cabina e con portata Q_e e limite persone C_e, capacità fisica `min(C_e,floor(Q_e/80))`, capacità pianificata `min(C_e,floor(ρQ_e/80))`. Con Q=1000 kg/C=13 entrambi i limiti sono 12; 13 persone peserebbero 1040 kg. Il grouping eterogeneo è definito nella [specifica supplementare D6](D6-CAPIENZE-INDIVIDUALI.md), completata ma da approvare nella sua formulazione.

Le sezioni seguenti descrivono il **riferimento originale** e il suo audit: conservano correttamente massa 76±14 kg, clipping 48–115 kg e riserva 87 kg. Questi valori non sono i nuovi default V2; i risultati storici restano identificabili e non vanno attribuiti allo scenario a 80 kg.

Verifica mirata, senza modificare i sorgenti: `make_requests` originale con configurazione in memoria mean=80/sd=0/min=80/max=80/reserve=80 ha generato 1857 richieste per seed 101, tutte di 80 kg. Conservando la chiamata originale alla normale con scala 0, ID/tempi/OD/tipi coincidono con quelli originali. Il futuro browser non necessita di draw fittizi del peso: la sua `generatorVersion` distingue la nuova sequenza; le fixture archivistiche possono essere migrate sostituendo solo la massa, conservando provenienza e nuovo hash. Non è stata eseguita una nuova simulazione di prestazioni a 80 kg.

## 1. Fonti, autorità e confini

Directory autorevole: `/tmp/ascensori-v2-phase-a.cXceUn/mathematical/Modello_Ascensori_V2`.
Sono stati letti integralmente TEX, PDF estratto con `pdftotext -layout`, JSON parametri, entrambi i moduli Python,
test, README, generatore del rapporto, macro generate, CSV, JSON dei risultati e testo dei sette grafici PDF.
Il PDF e il TEX descrivono le formule; il Python determina il comportamento che ha prodotto i risultati.
Quando differiscono, questa specifica distingue le due verità e propone una decisione esplicita.
ISO/CIBSE sono riferimenti bibliografici citati, non una certificazione o una validazione di questo simulatore.
Il riferimento è offline/DCS: origine e destinazione sono note alla chiamata; il peso reale è utilizzato all'imbarco.
Non introduce PLC, antincendio, accessibilità, manutenzione, jerk, energia o controllo hardware.
MPC globale e termine energetico sono una possibile estensione nel rapporto, **non sono implementati**.

## 2. Scenario, variabili e unità

- Piani `F={0,…,n}`; `n=upper_floors` conta soltanto quelli sopra terra; lobby invariabilmente 0.
- Cabine `E={0,…,m−1}` nel codice; la numerazione matematica 1…m del rapporto è solo notazione.
- Ufficio `o`: ID univoco, piano `f_o∈{1,…,n}`, addetti interi `N_o`, ora pranzo `h_o`, quota `p_o∈[0,1]`.
- Più uffici possono condividere un piano; `N_f=Σ_{o:f_o=f}N_o`, `N=Σ_o N_o`; piani senza uffici sono ammessi.
- Richiesta `r`: `a_r=born`, origine `source`, destinazione `dest`, massa `weight`; `p_r=pickup`, `d_r=finish`.
- Stato richiesta: WAIT→ONBOARD→DONE; assegnazione cabina e contatore retry sono separati dallo stato.
- Cabina: floor, next_floor, piano di task P/D/R, idle/moving/dwelling, occupanti e massa reale.
- Tempo interno: secondi float da mezzanotte. Ore JSON×3600, minuti×60; distanza in piani o metri esplicitamente.
- Fisica globale identica per tutte le cabine: `Q` kg, `C` persone, `v` m/s, `a` m/s², `h` m/interpiano.
- Parametri porta `b` s e trasferimento `u` s/persona; massa media/scarto/limiti e riserva in kg; `ρ` adimensionale.

Il brief richiede capienza configurabile **di ogni cabina**: il JSON/Python hanno un unico Q/C comune.
Le formule di imbarco Q_e/C_e del documento ammettono limiti individuali, ma routing e grouping implementati no.
La flotta omogenea non soddisfa tacitamente una richiesta di valori indipendenti per cabina: vedere D6.

Scenario allegato: n=15, m=4, 30 uffici, 525 addetti, focus U12-FOCUS al piano12 con65 addetti.
`Q=1000`, `C=13`, `v=2.5`, `a=1`, `h=3.3`, `b=5.5`, `u=0.8`, riserva87, `ρ=0.96`.
Massa dichiarata76±14kg, limiti48–115kg; finestra07:00–21:00; orari uffici descritti08:00–19:00.
Sono assunzioni dello scenario sintetico, non misure del palazzo; vanno mostrate come parametri espliciti.
`employees_per_floor=35` non rende uniforme il caso allegato: l'allocazione concreta deriva dagli uffici.

## 3. Domanda realmente generata

Il rapporto scrive `λ_od=λ_apertura+λ_pranzo+λ_chiusura+λ_altro`, con o≠d (PDF eq.1).
La miscela gaussiana per piano con quote(.35,.43,.22) è dichiarata semplificata/illustrativa (eq.2).
Il generatore effettivo è una popolazione finita con eventi normali/Bernoulli, **non un processo Poisson**:

1. `resolve_offices` risolve gli uffici; genera offset abituale stabile con habit_seed917, normale e clip±19min.
2. Per ciascun ufficio/giorno genera uno shift comune `J_o~N(0,2.5²)` minuti.
3. Per ogni addetto genera arrivo `N(7.88h,16²min)` 0→f e partenza `N(19.06h,17²min)` f→0.
4. Con Bernoulli(p_o) genera uscita pranzo centrata su `h_o+offset_o+J_o`, sd9min, f→0.
5. Lo stesso evento ha ritorno esattamente60min dopo, 0→f; uscita e ritorno sono correlati.
6. Con Bernoulli(.09) genera un solo viaggio interno f→dest alle ore uniformi09:00–18:00.
7. Per ogni **viaggio**, non per persona identificata, ricampiona la massa `clip(N(76,14²),48,115)`.
8. Ogni timestamp è saturato a `[start+1s,end−1s]`; ordinamento stabile per born, poi ID0…R−1.

La massa è quindi una **normale censurata ai limiti**, con masse puntuali agli estremi, non una normale troncata.
Gli orari saturati accumulano massa ai bordi; non sono normali condizionate alla finestra.
I tag office_id/trip_type sono aggregati sintetici; non esiste traiettoria individuale del dipendente.
Di conseguenza i viaggi interni non aggiornano la sede dei successivi viaggi già generati dello stesso addetto.
In media, senza cambi di organico, `E[R]=Σ_o N_o(2+2p_o+p_internal)`; nel caso base1853.25 richieste.
Il conteggio medio osservato1849.125 è una realizzazione Monte Carlo, non l'aspettativa teorica imposta.
La correlazione dovuta allo shift ufficio e alle coppie pranzo non va sostituita con arrivi indipendenti.
La destinazione interna è sorteggiata uniforme1…n, ma se uguale all'origine diventa `(f mod n)+1`.
Per n≥3 questo dà probabilità2/n al piano successivo,1/n agli altri consentiti; per n=1 produce1→1.

### Distribuzione degli uffici e configurazione esplicita

Se `definitions` è valorizzato, prevale: numero uffici deve coincidere con lunghezza se dichiarato.
Ogni voce fornisce id/floor/employees/lunch_start_hour/lunch_participation; il totale dichiarato non viene verificato.
Se manca l'elenco, si divide il totale quasi uniformemente tra uffici, dopo avere riservato l'organico focus.
I piani sono ciclici `(i mod n)+1`; il pranzo è scelto deterministicamente da `hrs[(i*7+floor) mod len(hrs)]`.
Il generatore non usa `lunch_start_probabilities`; nessuna normalizzazione delle quote avviene realmente.
L'elenco risolto e i totali per piano devono essere visibili prima dell'esecuzione; evitare distribuzioni implicite.

## 4. Fisica, capienza e obiettivo

Con `δ=h|f−g|`, PDF eq.5 e `travel_seconds` coincidono:
`T_moto=0` se δ=0; `2√(δ/a)` se δ≤v²/a; `δ/v+v/a` altrimenti.
Il tempo fermata documentale e DES è `T_stop=b+u(n_saliti+n_scesi)` per una fermata con trasferimenti.
Nessuna porta viene aperta per un R puro o per il solo pickup respinto; lo sbarco rimane un'operazione reale.
All'imbarco valgono contemporaneamente `L+w_r≤Q` e `occupanti+1≤C` (eq.6).
Nel piano si aggiunge riserva `w̃` per P e si sottrae massa reale per D già ONBOARD, riserva per D futuro.
Ogni P è ammissibile soltanto con `L_hat≤ρQ` e `n_hat≤C`; non si legge anticipatamente w_r per scegliere il piano.
La riserva non è una deroga al limite fisico; un futuro peso effettivo può comunque superare la prenotazione.

Il costo eq.10 corrisponde a `scoring`, date le sue ETA approssimate:

`J_t(S)=Σ_{r WAIT}[max(0,p̂_r−t)+(ζ/100)max(0,p̂_r−a_r−w0)²]+αΣ_r R̂_r`.

Per WAIT, `R̂=max(0,d̂−p̂)`; per ONBOARD, `R̂=max(0,d̂−t)`; gli utenti DONE non contribuiscono.
`α=.33`, `ζ=.035`, `w0=120s`; α è adimensionale e il coefficiente ζ/100 ha unità implicita1/s.
J è un costo in secondi equivalenti; il pregresso dell'attesa è costante tra candidati, la penale usa l'attesa totale.
La scelta eq.9 enumera cabina e inserimenti pickup i, drop j>i, minimizzando `ΔJ=J(nuovo)−J(esistente)`.
Durante moving non modifica il primo task/segmento; durante dwelling consente inserimenti prima dei task residui.
Il codice aggiunge un tie-break di `.001*|floor−source|` solo alla cabina idle senza piano (secondi-equivalenti/piano).
Scarta cabine con piano≥28task prima dell'inserimento; non è un'ottimizzazione globale della giornata.
Se il piano corrente è valutato impossibile, usa before=10⁷ come fallback numerico non documentato.

## 5. Tre politiche, nessuna baseline commerciale

| ID sorgente | Assegnazione reale | Parking reale |
|---|---|---|
| fifo | Min `ETA_nuovo+.28·ride_nuovo+.32·Σ max(0,ritardo_pickup_esistente)` | Nessuno: resta all'ultima fermata |
| optimal | Inserimento marginale J, precedente sezione | Euristica oraria e zone, non NNLS |
| adaptive | Esattamente lo stesso criterio di optimal | Forecast uffici appreso offline e grouping greedy |

`fifo` è un nome interno: non garantisce FIFO stretto di passeggeri e consente inserimenti davanti ad altri.
Label pubblico consigliato: baseline euristica, greedy sul costo J, adattiva con parking per ufficio.
Tutte proteggono con riserva e controllo fisico; gli stessi campioni OD/massa devono confrontare le tre politiche.
Baseline→optimal cambia costo e parking insieme; optimal→adaptive isola la regola di parking, non l'intero modello.
Gli allegati non autorizzano vantaggi rispetto a un impianto commerciale né vantaggi universali dall'apprendimento.

## 6. Apprendimento e raggruppamento

Per ufficio: `n_o` uscite pranzo training, D giorni, κ22eventi, α_prior12persone-giorno, σ0=9/60h.
Eq.14–15: `μ̂=(n_o·media(t)+κh_o)/(n_o+κ)`, `p̂=(n_o+α_prior p_o)/(D N_o+α_prior)`.
`σ̂²=(n_o s_o²+κσ0²)/(n_o+κ)` con varianza campionaria ddof1 se n_o>2; altrimenti σ0².
Implementazione limita σ̂ a4–30min e p̂ a.01–.99; senza eventi μ̂=h_o, ma p̂ non torna integralmente al prior.
La densità `λ̂_o=N_o p̂_o φ_{σ̂_o}(t−μ̂_o)` ha unità richieste/ora.
La domanda eq.16 è `D̂_o=N_o p̂[Φ((t+L+H−μ̂)/σ̂)−Φ((t+L−μ̂)/σ̂)]`, in richieste.
L3min/H12min; il ritorno trasla μ̂ della durata pranzo; somma uscite per piano e tutti i ritorni sullo0.
`floor_demand` valuta al **centro del blocco5min** contenente now e conserva una cache per identità modelli/config.
Training uffici12giorni1101…1112; holdout4giorni2201…2204; solo lunch_exit è utilizzato dal fit.
MAE è media errori assoluti conteggi5min per ufficio/giorno/bin11:30–15:00, non l'errore giornaliero globale.
Nessuna inferenza online: il modello è appreso una volta prima delle repliche di controllo.
Per dati reali l'attribuzione ufficio richiede dati aggregati osservabili; non va inferita dalla sola chiamata di piano.

Grouping documentale eq.17–19: `q=.82·min(C,floor(ρQ/w̃))` e
`G_f(k)=30[D_f^1.25−max(0,D_f−qk)^1.25]/max(1,D_f^.25)`.
Si massimizza copertura meno `.10·T_ef+.10·|floor_e−f|`; sono pesi euristici, non energia né benefici misurati.
Il greedy seleziona il miglior marginale positivo cabina/piano; soglia richieste3 ai piani,almeno5 sulla lobby.
Documento: allocazioni≤m_idle−1,≤1 per cabina,≤3 grouped per piano; codice differisce: vedere audit sotto.
I restanti target zonali sono `round(id·n/max(1,m−1))`; per m=1 il target zonale è0.
Round Python risolve i mezzi pari; un port JS non deve assumere automaticamente identità con Math.round.

NNLS aggregata eq.3–4: base costante + gaussiane a centri/scarti fissati, coefficientiβ≥0 via `scipy.optimize.nnls`.
Input istogrammi richieste/minuto10min; centri salita[7.88,13,14,15], discesa[12,13,14,19.06] nel caso base.
Split prime6repliche controllo training, ultime2test; R²/MAE sono sulla **media delle giornate test**.
Richiede almeno2giornate; sigma/bin devono essere validi; R² non è definito per varianza test nulla.
Questa NNLS genera un grafico e coefficienti diagnostici: non governa l'assegnazione o il parking.

## 7. Eventi, condizioni iniziali e termine

Heap ordinato `(time_s,counter_inserimento,event,args)`; a parità di tempo prevale counter, non il tipo evento.
INIT: tutte le cabine al0, idle/vuote/piano vuoto, nessun parking iniziale; now=0, NEW tutti già accodati.
La posizione0/5/10/15 del grafico07 è uno scenario illustrativo di grouping, non lo stato iniziale del DES.
NEW: prova assegnazione, altrimenti blocked; avvia i piani delle cabine idle.
ARRIVE: contabilizza distanza del segmento completato; consuma task **consecutivi** al piano, nell'ordine del piano.
Pickup e finish sono registrati all'istante ARRIVE, prima del tempo porta/trasferimento; aggiorna carico e stato.
Se vi sono trasferimenti, genera DOOR dopo b+u·n; altrimenti torna idle e schedula il prossimo segmento subito.
DOOR: idle, avvia task successivi, riprova blocked. Retry avviene su ARRIVE/DOOR, senza timer di servizio proprio.
PARK è accodato dopo NEW/ARRIVE/DOOR con35s nominali; validazione epoch=round(now,2), modalità e piano vuoto.
Una cabina moving conserva floor del piano partenza e next_floor del target: non esporta una posizione continua.
Il ciclo termina a heap vuoto o appena estrae evento con time>end; **non svuota le code dopo21:00**.
L'evento appena oltre fine non è processato; le distanze di segmenti non arrivati non entrano nei contatori.
Questa convenzione deve restare distinta da un futuro drain delle code, che modifica i risultati.

## 8. Metriche, statistica e trace

KPI per replica: count completati, unserved generati−completati, served_pct, W media/mediana/p90/p95,
quota W>120s, ride medio, journey medio, bypass, distance_floors, park_floors, door_stops,
adaptive_parking_decisions e max_grouped_same_floor. W=p−a, R=d−p, T=W+R (definizioni §2 del rapporto).
W/R/T e percentili sono sui **soli viaggi completati**; quota>120 usa120 fisso anche cambiando fairness_threshold.
Percentili NumPy predefiniti: interpolazione lineare; precisione interna float64, arrotondamento solo nel PDF.
JSON summary è media non ponderata dei KPI giornalieri e deviazione standard campionaria ddof1.
Media dei p95 giornalieri non equivale al p95 dei passeggeri raggruppati; ECDF grafico03 usa invece dati pooled.
CI95: differenze appaiate delle8medie wait fifo−optimal, `media(d)±t_.975,7·sd(d)/√8`.
Riduzione relativa: `100(1−media(Woptimal)/media(Wfifo))`; non media di8percentuali.
Non esiste CI dell'effetto adaptive nel codice, né certezza statistica sul campo.
Max grouped misura target pianificati in ciascuna decisione, escluso0; non occupazione simultanea fisica al piano.
Adaptive decisions conta decisioni, anche senza spostamenti. Distance e park sono piani, non kWh o metri.

Il riferimento restituisce requests/cars in memoria, poi salva KPI/fit/modello; **non salva trace eventi**.
Per V2 è proposto un trace autentico del motore approvato: chiamata, assegnazione/costo, segmenti, arrivo,
pickup/drop/retry, porte, parking, carico e snapshot finale, sempre con unità e ordine eventi.
Run/versione/seed/dataset hash sono metadati da implementare, non output già esistenti negli allegati.
La UI non deve ricostruire causalità o animazione cabin-by-cabin da soli KPI aggregati.

## 9. Traccia equazione → funzione → output

| PDF | Funzione originale | Output e limite |
|---|---|---|
| Eq.1–2 domanda | make_requests + resolve_offices | requests; miscela per piano solo illustrativa |
| Eq.3–4 NNLS | fitting | fits JSON/grafico01; nessun controllo |
| Eq.5 moto/stop | travel_seconds + ARRIVE/DOOR | timestamp in memoria, W/R/T, distanze/stops |
| Eq.6–7 carico | current_route_expected + ARRIVE | fattibilità, bypass; future_profile è inutilizzata |
| Eq.8/12 HC/INT | make_charts, RTT145 hardcode | grafico05 screening; RTT non stimato, INT non salvato |
| Eq.9–10 greedy/J | scoring + try_assign | piani e assegnazioni in memoria, KPI/CSV |
| Eq.11 MPC | nessuna | non implementata |
| Eq.13 uffici | resolve_offices | elenco uffici e totali, modello JSON |
| Eq.14–16 stime | fit_office_habits, forecast_office, floor_demand | modello/MAE, grafico06, domanda interna |
| Eq.17–19 grouping | choose_grouping + PARK | target, decisioni/group max, grafico07; mismatch vincoli |

## 10. Discrepanze e difetti da decidere, senza correzioni silenziose

| Priorità | Evidenza originale | Conseguenza concreta |
|---|---|---|
| Bloccante | sim:132–155 ETA moving=.5 intero segmento, dwelling=b intero; porta per task | ETA non residuo reale; piano valuta più porte del DES raggruppato |
| Bloccante | sim:273–290 commento sbarco prioritario, ma task in ordine lista | Pickup può essere respinto prima dello sbarco dello stesso piano |
| Bloccante | sim:244–253,287–296 retry usa politica normale, nessuna esclusione cabina | Non realizza “prima alternativa per ETA”; riserva non usa massa ormai osservata |
| Bloccante | stessa logica, peso individuo>Q ma riserva≤ρQ | Possibile retry infinito/ARRIVE a tempo invariato; nessuna salvaguardia |
| Bloccante | sim:338–349,409,416 | Zero completati: percentile fallisce; pickup None: chart fallisce prima CSV/JSON |
| Alto | uffici:151–152 slots=min(m_idle,m_tot−reserve) | Viola≤m_idle−reserve; anche unica idle può raggrupparsi |
| Alto | uffici:156,177–179 cap efficace≥1/fallback tutte free | Prevede capacità anche cap0; fallback può superare limite gruppi e muovere riserva |
| Alto | sim:303–322 epoch rinnovato a ogni evento; last_idle mai letto | Parking rinviato dal traffico; adaptive può muovere altre idle prima35s |
| Alto | sim:70–71,87–90; TEX:87,99 | Normale censurata≠troncata; n=1 auto-viaggi; destinazioni interne sbilanciate |
| Medio | TEX:284 contro uffici:80,88 | n_o=0 ritorna al programma per μ, non interamente per partecipazione |
| Medio | TEX:361 contro generazione uffici | Quote pranzo promesse/normalizzate ma mai usate |
| Medio | TEX:257/PDFp10 testo71 contro grafico05=67.8 | Numero narrativo non rigenerato dal dato |

Hardcode ulteriori: internal09–18; parking optimal9,11.7,12.6,15.35,18.55,19.55,19.5 e±.27ore.
Campi inattivi: lobby_floor, office_start/end_hour, lunch_start_probabilities,
experiment.relocation_forecast_horizon_minutes, offices.recompute_parking_delay_seconds.
employees_per_floor è solo fallback del totale automatico; lista per piano non controlla distribuzione uffici.
Focus piano12 del JSON impedisce n<12 senza modifica esplicita; manca validatore centrale range/tipi/finitezza.
Grafici hanno finestre7–20/20.5,11.5–15,12–14.5,11.5–14.75 e titoli “4 cabine/8 semi” fissi.
PDF/header/copertina conservano4cabine/15piani/focus65/RTT145; macros non aggiornano tutto il testo.
crea_rapporto scrive nella cartella fonte; skip-sim non verifica concordanza config/risultati e divide per MAEbase.

## 11. Verifica eseguita e decisioni per la Fase B

Audit eseguito soltanto con codice originale, dipendenze presenti, output isolato in `/tmp/ascensori-v2-phase-a.cXceUn/audit-reference`.
`python test_uffici.py`:4test passati; non coprono DES, overload, estremi n/m o censure.
`python simulatore_ascensori.py --config parametri_ascensori.json --out …/audit-reference`:24run,exit0.
Tre `cmp` hanno exit0: CSV metriche, JSON sintesi, JSON modello uffici **identici byte per byte** agli allegati.
Fontconfig ha segnalato cache non scrivibile; esecuzioni e file numerici sono completati; nessuna installazione.
Runtime audit: Python3.12.14/NumPy2.3.5/SciPy1.17.0/Matplotlib3.10.8; gli allegati non fissano queste versioni.
Valori riprodotti: W fifo95.706538/optimal11.220289/adaptive11.097962s; p95:517.772440/26.033163/25.956606s.
Tutte8×3repliche completano100%; differenza84.486249s, CI[58.374677,110.597822]s; dati sempre sintetici.
Originale travel:0piani0s,1piano3.63318042491699s,2piani5.14s,15piani22.3s.
Sogliaδ=v²/a=6.25m:5s; δ±10⁻⁸m produce4.999999996/5.000000004s (continuità verificata).
Reviewer indipendente ha confermato staticamente difetti eventi/capienza/censure; nessun codice modificato.

**D1 — autorità del motore (approvata).** Correggere esplicitamente ETA/porte/sbarco/retry/timer e blocchi metriche,
conservando l'originale come oracolo archivistico. Un profilo compatibile e uno corretto richiedono versioni distinte;
il profilo corretto non può ereditare i numeri/gain degli allegati. La decisione è stata approvata dall'utente.
**D2 — legge della domanda (approvata).** Massa fissa di 80 kg per persona, senza distribuzione del peso e con riserva di 80 kg. Restano clipping degli orari e bias della destinazione interna originale per n≥2; per n=1 il profilo approvato richiede probabilità interna 0. Nuove masse, generatore e dataset hanno provenienza/versioni proprie e non ereditano i risultati originali.
**D3 — grouping (approvata).** Rispettare vincolo sulle idle reali, significato operativo della riserva e limite sul risultato della decisione;
non presentare l'euristica attuale come conforme all'eq.19. Non generare copertura per capienza pianificabile 0.
**D4 — fine e KPI (approvata).** Mantenere orizzonte finito, esporre generati/picked/completed/WAIT/ONBOARD,
KPI completed-only dichiarati e null con campione vuoto; un eventuale drain è una diversa convenzione da approvare.
**D5 — contratto parametrico/RNG (approvata).** Validare interi m1…8/n1…50, finite/positive fisiche, tempi/probabilità/scarti,
uffici coerenti e total/distribuzione espliciti, senza clamp/coercizioni occultate. Seed+versione generatore+hash dataset
rendono riproducibile V2; un PRNG browser diverso può conservare le leggi ma non il dataset NumPy a parità di seed.
Confronto Python↔port numerico deve usare lo **stesso corpus OD**, tolleranze dichiarate e ordinalità eventi verificata.
**D6 — capienze per cabina.** L'utente ha autorizzato l'approfondimento per Q_e/C_e indipendenti, con massa fissa di 80 kg. La [specifica supplementare](D6-CAPIENZE-INDIVIDUALI.md) è completata: carichi per cabina, copertura B_f=Σ_e q_e x_ef, riduzione omogenea, riserva eleggibile e limite di target per decisione. Questa nuova formulazione richiede approvazione prima dell'implementazione; non è stata autorizzata una riduzione del brief a flotta omogenea. I numeri allegati restano quelli del riferimento omogeneo con masse stocastiche.
L'intero dominio m1…8/n1…50 richiede test successivi all'accordo; casi limite e plateau round tie-even sono obbligatori.
Il validatore V2 impone h/v/a/Q_e>0, C_e/N_o interi≥1, masse e riserva esattamente 80 kg, scarti temporali≥0,
ρ=0,96 nel profilo concordato, tempi non negativi e orizzonte crescente, probabilità∈[0,1], campioni/sigma validi per fit e seed espliciti. Le chiavi storiche w_min/w_max non sono input operativi V2.
La successiva istruzione dell'utente approva il default deterministico di 80 kg e D1–D5; non autorizza nuovi modelli stocastici, una diversa baseline o MPC. La specifica D6 resta distinta da ciò che è già approvato.

## 12. Verifica dimensionale della parametrizzazione

Questa verifica identifica le parti indipendenti dal caso 4/15; non dimostra che il codice con i difetti elencati sia corretto sull'intero dominio.

| Parte | Argomento di indipendenza da m e N | Condizione o limite |
|---|---|---|
| Cinematica | T dipende da δ=h|f−g| e da h/v/a; per f,g∈{0,…,N} la stessa legge è definita per ogni N finito. | h/v/a positivi; restano identiche le semplificazioni fisiche. |
| Capienza omogenea | Le somme di massa e persone si riferiscono a una singola sequenza: aggiungere cabine o livelli non cambia le disuguaglianze. | Non dimostra la variante eterogenea del grouping; D6 è ora specificata separatamente e resta da approvare. |
| Inserimento greedy | La minimizzazione su un insieme finito E_m e su coppie i<j non richiede m=4; la fattibilità resta locale alla cabina. | Se l'insieme fattibile è vuoto la richiesta resta pendente; D1 regola retry e ETA. Nessuna proprietà di ottimo globale. |
| Uffici e forecast | Le somme per piano e le stime per ufficio non dipendono dal numero di cabine; un elenco con f_o∈1…N resta valido. | Focus, distribuzione, organici e osservabilità devono essere espliciti e validati. |
| Target zonali | Per m≥2, 0≤eN/(m−1)≤N; l'arrotondamento al più vicino mantiene il target in 0…N. Per m=1 il riferimento produce target0. | Questo prova soltanto il range geometrico: riserva, collisioni di target e limite grouping richiedono D3. Tie-even va preservato nel profilo archivistico. |
| NNLS diagnostica | Le dimensioni dipendono da intervalli temporali e basi gaussiane; m/N cambiano i conteggi osservati, non il problema NNLS. | Il numero di componenti, le fasce e i campioni restano quelli configurati/validi; il fit non valida il controllo. |

Il caso N=1 ha un unico piano uffici: il requisito o≠d elimina i viaggi interni tra piani sopra terra, senza eliminare ingresso, uscita o pranzo via 0. La probabilità interna 0 è approvata in D2 e deve essere mostrata. Per m=1 con riserva 1 il raggruppamento proattivo non ha slot, mentre l'assegnazione delle richieste continua a funzionare. Queste condizioni impediscono di applicare meccanicamente tutti i default del caso 4/15.

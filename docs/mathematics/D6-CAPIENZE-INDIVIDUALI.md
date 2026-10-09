# D6 — capienze indipendenti con massa fissa di 80 kg

Specifica supplementare approvata con i limiti sotto dichiarati, 9 ottobre 2026.
La massa **80 kg per persona** è un'istruzione approvata dell'utente; vale per massa reale e riserva.
L'utente ha autorizzato D6 e la Fase B dopo aver valutato origine e confrontabilità di q_e e D_f.
La derivazione resta un'estensione dichiarata, non contenuta nella proposta iniziale né attribuita al rapporto.
D1–D5 aggiornate a 80 kg restano il quadro concordato; le fixture offline non costituiscono un nuovo motore.

## Fonte e distinzione delle autorità

Il rapporto allegato, eq.6–7, contempla Q_e/C_e individuali; il Python utilizza invece un solo Q/C comune.
Il grouping documentale eq.17–19 usa `q=.82·min(C,floor(ρQ/w̃))`, G_f(k,q) e riserva sulle cabine idle.
Quella formula non specifica flotte eterogenee. Qui si deriva un'estensione, senza attribuirla al rapporto.
Il riferimento originale, i suoi hash e risultati rimangono invariati: avevano masse variabili e riserva 87 kg.
Anche il confronto omogeneo a 80 kg richiede risultati nuovi; non eredita i guadagni storici del PDF.

## Capacità per cabina e condizioni di servizio

Per ogni cabina e: `Q_e>0` kg, `C_e≥1` persone intere, `ρ=.96`; massa di ogni richiesta `w_r=w̃=80 kg`.

`c_e^real = min(C_e, floor(Q_e/80))`
`c_e^plan = min(C_e, floor(.96 Q_e/80))`
`q_e = .82 c_e^plan`

I primi due sono posti interi effettivi/pianificabili; q_e è un conteggio equivalente di copertura per decisione.
Rappresenta un singolo lotto euristico, anche frazionario: non richieste/minuto né throughput empirico in 12 min.
Il fattore .82 è preso dalla fonte e converte posti pianificabili in copertura equivalente; non è calibrato su misure.
Imbarco: `80(n_e+1)≤Q_e` **e** `n_e+1≤C_e`; pianificazione: `80 n̂_e≤.96 Q_e` **e** `n̂_e≤C_e` lungo il piano.
Il routing valuta ogni cabina con la propria capacità; velocità, accelerazione, interpiano e porte restano comuni.
Con c_plan=0 nessuna nuova prenotazione è fattibile e q_e=0: nessun artificio `max(1,q_e)`.
Q_e=80/C_e=1 ha c_real=1 ma c_plan=0: il margine impedisce il servizio pianificato, non la capacità fisica.
Una flotta tutta c_plan=0 produce domanda non servita nell'orizzonte, KPI completed-only null e diagnosi esplicita.
Non si ritenta una richiesta nello stesso stato a tempo invariato; la massa fissa non spiega rifiuti casuali di peso.
Un rifiuto in un piano coerente richiede diagnosi di stato/ordine/capienza; non si inventano fluttuazioni della massa.

## Copertura eterogenea e problema di allocazione proposto

D_f è il conteggio atteso di chiamate individuali di pranzo/ritorno, eq.16, nella stessa finestra futura per tutti gli uffici.
`t_block=300 floor(now_s/300)+150` s è il centro del blocco corrente di 5 min, come `floor_demand` nella fonte.
Con L=3 min e H=12 min la finestra è `[t_block+180 s,t_block+900 s]`, non `[now,now+H]`.
Ai piani superiori si sommano le uscite degli uffici; al piano 0 tutti i ritorni, con media traslata di 60 min.
Ogni D_o integra la densità gaussiana tramite differenza di CDF: non è il tasso λ_o espresso in richieste/ora.
La comparazione D_f/B_f assume esplicitamente **una chiamata = un passeggero/viaggio**, coerentemente con Request originale.
Una prenotazione di gruppo non può contare come una singola richiesta del modello senza un'altra specifica.
Con tale assunzione, D_f e q_e/B_f hanno unità compatibili di conteggio equivalente; non si moltiplica q_e per H.
È validazione dimensionale/algebrica: la fonte non calibra .82, cicli o capacità fisicamente erogata dalla flotta in H.
I test sintetici del fit non convalidano quel fattore; non esistono qui test empirici o garanzie di copertura della domanda.
I(t) contiene cabine idle, vuote, senza piano, con c_plan≥1 e almeno 35 s continuativi di inattività **per cabina**.
Richieste reali e occupanti hanno priorità; con WAIT non assegnate non si emette un comando proattivo.
Per e∈I(t), f∈{0,…,N}: `x_ef∈{0,1}`, `k_f=Σ_e x_ef`, `B_f=Σ_e q_e x_ef`.

`G_f(B_f)=30 [D_f^1.25 − max(0,D_f−B_f)^1.25] / max(1,D_f^.25)`
`max_x Σ_f G_f(B_f) − .10 Σ_ef T_ef x_ef − .10 Σ_ef |floor_e−f| x_ef`

`Σ_f x_ef≤1`; `Σ_ef x_ef≤max(0,|I(t)|−1)`; `k_f≤3` per ogni piano, incluso 0.
Per cabine non eleggibili o c_plan=0, x_ef=0. Il budget è un limite superiore, non un obbligo di utilizzare gli slot.
La riserva è almeno una cabina eleggibile senza x; rimane al piano corrente e disponibile al dispatch ordinario.
Cabine c_plan=0 non sostituiscono questa riserva, perché non possono soddisfare una prenotazione conservativa.
Il punteggio ha unità convenzionali di secondi equivalenti: 30 pesa richieste, .10 pesa secondi e piani.
Le potenze sono applicate ai conteggi numerici; questi pesi restano euristici, non kWh né attese risparmiate osservate.

## Greedy, riserva, fallback e riduzione esatta

Da B_f=0 si sceglie la coppia libera e/f con maggior marginale positivo:
`Δ_ef=G_f(B_f+q_e)−G_f(B_f)−.10 T_ef−.10 |floor_e−f|`.
Si aggiorna B_f/k_f e si rimuove e dalle candidate; si arresta al budget, ai vincoli o all'assenza di guadagni positivi.
Si mantengono le soglie della fonte: D_f≥3 ai piani superiori e D_0≥5 alla lobby.
Tie proposto: valore decrescente, poi ID cabina e piano crescenti; ordine deterministico e verificabile.
Ogni eventuale fallback zonale usa solamente slot residui e gli stessi vincoli/marginale positivo; altrimenti KEEP.
Nessun target viene creato implicitamente per tutte le cabine rimaste: riserva e KEEP non ricevono riposizionamento.
Un target con spostamento zero conta comunque in x, budget e k_f; KEEP è uno stato senza assegnazione proattiva.
Il limite k_f riguarda **target assegnati nella singola decisione corrente**, non tutte le cabine fisicamente presenti o in transito su quel piano.
Le cabine con PARK pregressi ancora in movimento non appartengono a I(t); tali impegni non entrano in B_f né nel cap k_f corrente.
Questa è la semantica approvata: non si aggiunge un vincolo globale di tre cabine o impegni attivi per piano, assente dalle eq.17–19.
Questa distinzione è indispensabile: con 8 cabine e N=1 la presenza fisica non può rispettare max3 su soli 2 livelli.
Il trace distingue assegnazione, partenza/arrivo e KEEP; il replay non rappresenta k_f come presenza fisica osservata.
Con Q_e=Q/C_e=C si ha q_e=q per tutte le cabine: `B_f=qΣ_e x_ef=q k_f`, quindi G_f(B_f)=G_f(k_f,q) **esattamente**.
Anche il marginale torna `G_f(k_f+1,q)−G_f(k_f,q)−costo`: nessun termine aggiuntivo nella funzione di guadagno.
La riduzione vale per la formula della fonte; non riproduce i suoi bug su riserva, cap0 e fallback.
La copertura è additiva e monotona con beneficio marginale decrescente; il greedy non garantisce l'ottimo globale.
Non aggiunge cicli reali, carichi eterogenei, tempi diversi per cabina, priorità aziendali o MPC.

## Casi numerici derivati, non risultati di simulazione

| Cabina illustrativa | Q_e kg / C_e | c_real | c_plan | q_e |
|---|---|---:|---:|---:|
| A | 1000 / 13 | 12 | 12 | 9.84 |
| B | 640 / 10 | 8 | 7 | 5.74 |
| C | 800 / 10 | 10 | 9 | 7.38 |
| Limite | 80 / 1 | 1 | 0 | 0 |

Calcolo B: `.96·640=614.4`; `floor(614.4/80)=7`; il posto fisico ottavo non è pianificabile con il margine.
Esempio costruito: A/B/C eleggibili, A/B già al piano f≥1, C al0, D_f=12, costi A/B=0 e costo C→f positivo.
Il budget è 2. Con A/B assegnate, B_f=9.84+5.74=15.58, domanda residua0, k_f=2 e G_f=30·12=360.
Con sola A la residua è2.16: `G_f=30[12^1.25−2.16^1.25]/12^.25`; B ha guadagno marginale positivo.
Non è un'attesa di 360 s: è il punteggio di copertura dell'esempio. Per due cabine omogenee A, B_f=2·9.84.
Con M=1 il budget è0: adaptive non preposiziona, ma continua il dispatch fattibile; nessuna promessa di prestazioni uguali.
Con N=1 gli uffici sono al1 e il traffico interno deve avere probabilità0, come D2 concordata; target solo0/1.
Con M=8/N=1 si possono assegnare al massimo6target (3 per piano), anche se il budget fosse7; gli altri restano KEEP.

## Mapping, riproducibilità e verifiche future

`cabins[id].ratedLoadKg/maxPeople` → Q_e/C_e → tabella immutabile c_real/c_plan/q_e condivisa da dispatch, boarding e grouping.
Massa/riserva sono literal80, non nuovi parametri per cabina; ρ resta .96. Le vecchie chiavi peso sono provenienza della fonte.
Nuova versione generatore/seed/hash dataset; niente draw di massa fittizi per imitare il consumo RNG originale.
Per un confronto isolato si può migrare un corpus OD originale sostituendo solo weight con80, etichettando la trasformazione.
Le tre politiche ricevono lo stesso corpus80 e la stessa flotta. Storico original/clipping e nuovo fixed80 rimangono distinguibili.
Accettazione: riduzione omogenea algebrica/numerica, casi sopra, soglie Q=80/.96, Q=80, saturazione C e q0 senza loop.
Verificare carichi a ogni task, timer individuale, precedenza servizio, riserva, budget e cap target della decisione anche col fallback.
Un caso con PARK pregressi ancora in movimento deve verificare che non siano ricontati in I/B/k né rappresentati come copertura nuova.
Verificare tutto M=1…8/N=1…50, lobby, stato vuoto, ties/round Python, censure e replay coerente con trace.

**Decisioni D6 approvate con questi caveat:** funzione B/G eterogenea, eleggibilità con riserva trasportabile, semantica target contro presenza,
fallback non forzato e vincolato, tie deterministico e comportamento diagnostico della flotta non pianificabile.
Sono ipotesi supplementari esplicite; l'approvazione non costituisce una validazione empirica dei benefici del parking.
Limite dichiarato: il cap è per decisione; un eventuale cap globale richiederebbe un altro modello degli impegni,
con ciclo di vita esplicito e nuova approvazione. Il modello approvato non garantisce un limite cumulativo fra decisioni.
Eventuali guasti, tempi per cabina o altri pesi riaprirebbero il modello.

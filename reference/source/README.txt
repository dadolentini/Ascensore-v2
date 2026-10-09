OTTIMIZZAZIONE PARAMETRICA DI 4 ASCENSORI - CASO TECNICO

File principali:
- rapporto_ascensori.pdf: documento tecnico completo (bianco/nero).
- parametri_ascensori.json: tutti i parametri modificabili.
- simulatore_ascensori.py: simulazione a eventi discreti, 2 algoritmi di dispatch, NNLS e 5 grafici.
- crea_rapporto.py: esegue la simulazione e aggiorna PDF/grafici/CSV.
- rapporto_ascensori.tex: sorgente tecnico con formule LaTeX.
- risultati/: CSV, dati del fit, figure e log utilizzabili.

COME RIGENERARE CON NUOVI PARAMETRI
1. Installare Python 3.10+ e LaTeX (lualatex) sul computer.
2. pip install numpy scipy matplotlib
3. Modificare parametri_ascensori.json.
4. Dalla cartella corrente: python crea_rapporto.py --config parametri_ascensori.json
5. Aprire rapporto_ascensori.pdf e risultati/metriche_repliche.csv.

IMPORTANTE
I parametri del PDF includono anche valori descrittivi fissi dello scenario
(es. 'RTT = 145 s' nello screening e 'posizione a 0/5/10/15' per il caso 4 cabine / 15 piani).
Per cambiare radicalmente numero di piani, numero di cabine o modelli statistici,
adattare inoltre i testi del rapporto tecnico alle nuove ipotesi.

Assume interfaccia DCS (destinazione nota alla chiamata) per entrambe le politiche.
Non puo' essere collegato direttamente a un ascensore reale, non e' un software
di sicurezza, non e' certificato o validato su misure del palazzo.

ESTENSIONE: APPRENDIMENTO UFFICI E RAGGRUPPAMENTO
------------------------------------------------
Configura `offices.number_of_offices` e `offices.total_employees`, oppure passa
`offices.definitions` con una voce per ufficio, ad esempio:
  {"id":"U07", "floor":7, "employees":33, "lunch_start_hour":12.5,
   "lunch_participation":0.68}
Se `definitions` non e' vuoto, la sua lunghezza deve coincidere con number_of_offices.
Piu uffici possono occupare lo stesso piano, con abitudini diverse.
`offices.focus_office` opzionale definisce un grande ufficio illustrativo del caso auto.
Le abitudini stabili simulate non sono fornite al fit: sono apprese dai log sintetici
di 12 giornate diverse dai 4 giorni di validazione, prima del test degli ascensori.
Per i dati reali serve un conteggio aggregato AFFIDABILE per ufficio; le chiamate
normali di piano da sole NON rivelano a quale ufficio appartiene un utente.
La terza politica 'adaptive' preposiziona soltanto cabine inattive, usando
la funzione `choose_grouping`; i vincoli reali di kg e persone prevalgono.
`risultati/modello_uffici_appreso.json` conserva le stime per ogni ufficio.
`grafico_06` mostra il fit del pranzo per l'ufficio maggiore.
`grafico_07` collega stima della domanda per ufficio e numero di cabine raggruppate.
Sono strumenti di ricerca: NON interfacciarsi direttamente con PLC.

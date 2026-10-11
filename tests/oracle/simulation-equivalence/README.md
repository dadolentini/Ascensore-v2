# Equivalenza esatta del simulatore V2

`original-results.json.gz` contiene gli input e tutti i `PolicyResult` originali,
incluse le trace complete, gli snapshot, i link alle equazioni, l'ordine heap,
le assegnazioni e tutti i timestamp e KPI. Non contiene solo medie o hash degli
output. Si può leggere con `gzip -dc tests/oracle/simulation-equivalence/original-results.json.gz`.

Le attese sono state prodotte l'11 ottobre 2026 esclusivamente dalla copia
immutabile `/tmp/elevator-before-fix/src`, creata prima delle ottimizzazioni.
Il motore è il V2 fixed80 approvato, distinto dal Python storico con pesi
variabili. `provenance.json` identifica ogni file originale, bundle, lockfile,
strumenti, corpus e payload tramite SHA-256. Il test controlla gli hash del
payload prima del confronto. Le attese non vengono rigenerate dai sorgenti
che il test sta verificando.

Il corpus comprende 11 scenari e 33 risultati FIFO/optimal/adaptive:

- Richieste simultanee realmente bloccate e retry a 1/8 cabine e 1/50 piani.
- Flotte eterogenee, ID non ordinati, pareggi e cabine con capacità pianificabile zero.
- Orizzonte finito con richieste WAIT/ONBOARD; nascita esattamente al termine.
- Collisioni NEW/ARRIVE/DOOR e inserimento nell'ordine originale degli eventi.
- Parking maturo con domanda positiva, seguito da domanda reale e retry.
- Domanda generata con partecipazione pranzo al 72%/100%, seed 101/202,
  apprendimento su seed indipendenti e picchi concentrati per creare code.

Il confronto è esatto, senza tolleranze sui numeri e senza esclusione di campi.
La sola normalizzazione JSON rimuove proprietà opzionali con valore
`undefined`, come l'esportazione originale. Sono verificati anche i vincoli
fisici e l'indipendenza dei risultati dall'attivazione della trace. I tempi
reali di calcolo non sono criteri di accettazione del test.

I test verificano inoltre che la callback di avanzamento conservi ogni campo
originale. Per il recupero esplicito di una registrazione oltre il budget,
un errore `unsupported/resource-trace` viene iniettato nella sola corsa
selezionata: tutti gli output recuperati e i dati vengono confrontati con
questi attesi originali. Errori matematici, limiti eventi, errori generici e
un eventuale errore della ripetizione devono propagarsi senza risultati
parziali o altri recuperi.

Questo corpus copre le parti interessate dall'ottimizzazione. Non sostituisce
una misura isolata dello scenario utente con 1.800 persone e 24 risultati,
né costituisce validazione empirica del modello o del fattore 0,82.

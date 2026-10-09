# Oracle numerico offline

[fixture-numeriche.json](fixture-numeriche.json) contiene input e attesi numerici, non risultati di una nuova simulazione.
Calcoli verificati il 9 ottobre 2026 con Python 3.12.14, NumPy 2.3.5 e SciPy 1.17.0 già presenti; nessuna installazione.
Gli hash SHA-256 identificano il codice/TEX originale utilizzato. Le fonti complete sono descritte in [provenienza](../../docs/sources/README.md).

## Autorità delle due sezioni

- `originalInvariant`: `travel_seconds`, `fit_office_habits`, `forecast_office`, `floor_demand` e `office_bin_expectation`
  chiamate direttamente dagli originali; CDF/quantili normali e Student da SciPy, quantile lineare e deviazione ddof1 da NumPy.
  `nnlsGaussianCase` usa direttamente `scipy.optimize.nnls` e le formule MAE/R² del `fitting` originale.
- `approvedFixed80Extension`: aritmetica della [D6 approvata](../../docs/mathematics/D6-CAPIENZE-INDIVIDUALI.md), distinta dal motore storico.
  Non si attribuiscono all'originale la flotta eterogenea, la massa fissa80 o la semantica corretta di riserva/fallback.

Le fixture non implicano parità di generatori per seed, validazione empirica o esecuzione del futuro motore V2.
Il confronto di politiche richiede sempre lo stesso corpus OD e la stessa flotta; questi sono test dei primitivi numerici.

## Casi e convenzioni

Moto: 0/1/2/15 piani, con h=3.3 m, v=2.5 m/s, a=1 m/s²; tre casi ai lati/centro della soglia δ=v²/a=6.25 m.
La voce `floorHeightM` dei casi soglia è la distanza artificiale su un singolo piano: verifica la formula, non un palazzo reale.
CDF/quantile normale usano N(0,1); Student usa df1/7/30; la CI appaiata usa differenze [1,2,3,4] s e sd campionaria.
Quantili lineari: ordinare i valori, posizione `(n−1)p`, interpolare tra gli indici adiacenti; un singolo valore resta invariato.
Per un campione vuoto V2 restituisce null: non chiamare il percentile NumPy su un array vuoto né creare uno zero fittizio.

Shrinkage: un ufficio di 4 addetti, pausa13:00, quota prior.5, κ=2 eventi, α=2 persone-giorno, σ0=6 min.
Due giorni hanno uscite [12.9,13.0] e [13.1,13.2] ore: n=4, media13.05, μ̂13.033333…, p̂.5 e σ̂≈.120185 ore.
Il modello con due giorni senza uscite conserva μ=13 e σ=.1, ma p̂=.1: è il comportamento originale, non prior.5.
I log sono piccoli input sintetici costruiti; ogni record rappresenta un'uscita pranzo individuale, senza simulazione DES.

Forecast canonico: N=4, p̂=.5, μ̂13h, σ̂.1h; nella finestra μ±σ l'atteso è 2·[Φ(1)−Φ(−1)].
Il ritorno trasla μ̂ di 60 min; i casi diretti dell'ufficio usano tHour+L/H, quelli per piano il centro del blocco5min.
now46440 e46499 s hanno lo stesso t_block46350 s e la stessa finestra46530–47250 s.
Quindi D_f è conteggio nella finestra di12 min anticipata3 min, non un tasso e non l'atteso nei12 min da now.
Le chiavi di `expectedByFloor` sono stringhe JSON di indici interi; la lobby0 aggrega i ritorni.

D6: real/planned rispettano insieme kg e posti; Q80/C1 distingue capacità fisica1 e pianificabile0, senza copertura fittizia.
La fixture G include D=0 e D=.5: per D<1 il denominatore resta1, quindi la saturazione non equivale a30D.
Il marginale da B=9.84 con aggiunta5.74 a D=12 è circa42.20784045 punti, non secondi di attesa risparmiati.
La riduzione omogenea B=qk è identità algebrica, mentre il greedy è euristico e non un ottimo globale.
NNLS: A è una base costante più due gaussiane di centro8/9 h e σ=.5 h, valutate a7/8/9/10 h; non è un'identità.
Con b=[2,1,4,4] richieste/min, il coefficiente della prima gaussiana è0 nell'ottimo non negativo e il residuo L2≈2.131136 è non nullo.
MAE=`mean(abs(test−pred))`; R²=`1−sum((test−pred)²)/sum((test−mean(test))²)`, come `simulatore_ascensori.py:383–384`.
Il tiny holdout uguale a b è deliberato per isolare l'aritmetica: nessuna conclusione fuori campione o empirica.
q è un lotto equivalente per decisione, grazie all'assunzione1 chiamata=1 passeggero e al fattore.82 della fonte.
Nessun caso dimostra throughput della cabina in12 min: non vi sono calibrazione .82 o test empirici della flotta.

## Uso e accettazione

Confrontare output del port con gli attesi usando le tolleranze assolute per categoria; conteggi/capacità interi devono coincidere esattamente.
Le tolleranze separano arrotondamento float da errori di formula: non usarle per cambiare una soglia di capacità o mascherare una discrepanza.
Il test runner deve leggere questi dati ed eseguire le funzioni reali del port; importare il JSON senza confronti non è verifica.
Verificare anche timer35 s per cabina, riserva, cap3 per decisione, fallback, precedenza sbarco e censure con test DES dedicati.
Questi scenari dinamici e il dominio M1…8/N1…50 non sono convalidati dal solo presente oracle numerico.

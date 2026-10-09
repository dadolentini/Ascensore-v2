# Modello, domanda e numerica — Fase B

Implementazione del profilo `v2.fixed80.corrected.1`, generatore `v2.sfc32.boxmuller.fixed80.1`.
Fonte: configurazione e funzioni `make_requests`, `travel_seconds`, `resolve_offices`, `fit_office_habits`,
`floor_demand`, `fitting` negli originali indicizzati da `docs/sources/MANIFEST.json`.
Le masse originali rimangono solo nei metadati; ogni richiesta e prenotazione V2 pesa esattamente 80 kg.

## API e separazione

- `defaults.ts`: scenario esplicito 4 cabine, 15 piani sopra terra, 30 uffici, 525 addetti, focus65.
  La lista degli uffici risolve la distribuzione originale: 25 uffici da16, 4 da15, focus65.
- `validate.ts`: ingresso `unknown`, risultato discriminato, tipi/finitezza/interi, flotta1–8 e piani1–50,
  piani uffici1–N, IDs unici, probabilità e scarti, orizzonte crescente e profilo fisso.
  Nessuna coercizione, normalizzazione o correzione automatica; capienza zero ammessa.
  Sono respinte combinazioni fisiche finite il cui moto massimo non è rappresentabile in float64.
- `physics.ts`: cinematica triangolare/trapezoidale e capacità individuali fisica/pianificata/copertura.
- `reproducibility.ts`: JSON canonico con chiavi ordinate, numeri finiti, ordine liste preservato; SHA-256.
- `demand.ts`: corpus OD immutabile per convenzione di run, seed/versione/hash, massa80 senza draw.
- `officeModel.ts`: apprendimento offline, forecast e MAE holdout per ufficio/giorno/bin5min.
  `estimateOfficeModels` consente il confronto numerico su un corpus OD condiviso, indipendente dal PRNG.
- `numerics.ts`: media compensata, quantile lineare, CDF normale, NNLS Lawson–Hanson con QR Householder,
  CI95 appaiata con Student t tramite `jstat`1.9.6 (tipi locali sulle sole API usate).
- `flowFit.ts`: diagnostica NNLS su conteggi reali/minuto, split6/2 con8 giornate, gaussiane della fonte.

## Convenzioni verificate

Il PRNG espande l’etichetta versione/dominio/seed con xmur3 in quattro parole, usa sfc32 con12 round iniziali,
e Box–Muller con secondo valore memorizzato. Uniformi in `[0,1)`, logaritmo su `1-u`.
I domini `habits` e `main` sono separati; seed come stringhe decimali uint64 canoniche e gruppi disgiunti.
Offset di abitudine fisso per ufficio, normale censurata a ±19min; shift giornaliero unico per ufficio.
Ogni addetto genera ingresso e uscita; la partecipazione genera una coppia pranzo a durata configurata
(default60min), prima del clipping indipendente `start+1`/`end-1` dei timestamp come nella fonte.
I viaggi interni conservano il bias della fonte per N≥2; N=1 impone probabilità0 nel validatore.
Gli eventi a pari timestamp conservano l’ordine di generazione; IDs finali consecutivi dopo il sort.
Il PRNG browser conserva queste leggi, senza attribuire parità di corpus al seed NumPy originale.

Shrinkage usa varianza campionaria ddof1 solo con più di2 uscite; altrimenti sigma prior.
I limiti4–30min e .01–.99 sono parte esplicita dell’estimatore originale, non clamp degli input.
Il caso senza uscite mantiene l’orario e sigma prior ma restringe la partecipazione con i giorni/addetti.
Forecast valutato al centro del blocco5min, con lead3/H12; lobby aggrega i ritorni traslati.
Cache per identità dei modelli/scenario e blocco: gli input di un run devono restare immutabili.

La copertura `.82*c_plan` è un proxy di lotto equivalente in una decisione; non stima il throughput
fisico della cabina in12min e non dimostra calibrazione empirica di .82. NNLS diagnostica non governa dispatch.
`fitFlow` restituisce null con meno di2 giornate, sigma gaussiana nulla o nessun bin completo;
R² è null con varianza holdout zero. Oltre20000 edges viene emesso un errore di risorse esplicito,
senza cambiare il bin richiesto. CI appaiata è null sotto2 campioni; media e quantili sono null con campione vuoto.

## Evidenza locale

9 ottobre2026, `npm test -- tests/model`: **61 test passati su3 file**, Vitest5.0.3.
Include40 confronti dell’oracle offline con Python3.12.14/NumPy2.3.5/SciPy1.17.0:
moto e continuità, CDF, quantili, Student e CI, shrinkage su corpus identico, forecast per piano e capienze D6.
Le altre21 verifiche coprono input malformati/nonfinite/seed, determinismo/hash, peso80, conteggi finiti,
coppie pranzo, shift condivisi, bias destinazioni, N1, clipping/ordine ties, NNLS attiva e unità conteggi/min.
Il test dell’overflow è stato osservato fallire prima della correzione del validatore.

Esecuzione dell’intera suite alle08:14:04:83 passati,1 failure nel test timer engine e2 suite worker
con moduli ancora assenti durante lo sviluppo parallelo. I responsabili sono stati informati;
questo report non attribuisce alla numerica la conclusione delle verifiche di integrazione successive.
Typecheck modello senza errori; verifiche globali/build finale di competenza dell’integrazione root.

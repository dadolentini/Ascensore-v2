# Ascensore V2 — proposta motion, Fase A

> Fotografia della Fase A; l’implementazione e le integrazioni autorizzate sono documentate in [VALIDAZIONE.md](../VALIDAZIONE.md). D1–D6 e Fase B sono successivamente approvate; le note di autorizzazione iniziale sotto sono storiche.

## Intento e confini

1. La motion guida la lettura di domanda, vincoli, decisioni e risultati; non aggiunge comportamento al modello.
2. Esperienza editoriale 2D nel normale scroll: nessuna camera virtuale, scena 3D o navigazione nell'edificio.
3. I quattro PNG sono riferimenti fotografici statici: luce calda, verticali ordinate, materiali e ritmo calmo.
4. Palette condivisa con UX: avorio `#F5F1E8`, carbone `#1D2428`, ottone `#8A613C`; ottone come accento, non unica codifica.
5. Fotografie senza zoom, parallasse, apertura artificiale delle porte o morph in diagrammi tecnici.
6. Questo documento specifica comportamento futuro; non sono stati installati strumenti né realizzate animazioni.

## Tecnologia e regole comuni

7. Default: scroll nativo, IntersectionObserver per attivare capitoli, CSS/WAAPI per brevi transizioni di SVG e UI.
8. GSAP/ScrollTrigger resta opzionale: adottarlo solo se una sequenza coordinata supera la chiarezza e il costo della soluzione nativa.
9. Motivazione ammissibile: una timeline con molti elementi sincronizzati e inversione robusta; non il solo effetto premium.
10. Se adottato: modulo separato per la landing, timeline locali, `matchMedia` e cleanup; nessun collegamento al motore DES.
11. Lenis non previsto: scroll nativo conserva ancore, tastiera, touch e comportamento del browser senza un secondo clock.
12. Nessun pin, scroll hijacking, snap obbligatorio o lunga sezione vuota per completare un'animazione, anche desktop.
13. Testi, formule, numeri, link e controlli sono visibili nel DOM prima di qualsiasi enhancement JavaScript.
14. Trigger narrativo: il blocco entra nell'area tra 25% e 75% dell'altezza del viewport; conta l'ordine del documento.
15. Entrata di un dettaglio grafico: 240–360 ms; distanza massima 12 px; easing `cubic-bezier(.2,.7,.2,1)`.
16. Accento o stato selezionato: 120–160 ms; nessun bounce, spring, flash, lampeggio o loop decorativo.
17. Sequenza di massimo tre dettagli: intervallo 60 ms, durata totale massima 480 ms; non ritardare il testo per attendere la sequenza.
18. Scorrendo indietro, cambia solo il capitolo evidenziato: i reveal eseguiti restano completi, senza replay o reset.
19. Salto con ancora/scroll veloce: mostra subito lo stato finale; nessun contenuto obbliga ad attendere o tornare indietro.
20. La simulazione e il suo stato rimangono invariati entrando, uscendo o tornando a una sezione narrativa.

## Storyboard delle otto sezioni

| Sezione | Stato e azione di motion | Trigger e limite | Valore per la comprensione |
| --- | --- | --- | --- |
| 1. Hero | Torre statica, titolo già presente; un solo accento lineare sul sottotitolo, senza movimento dell'immagine. | Dopo readiness locale, 280 ms una volta; nessun ritardo alla CTA. | Introduce il progetto e le due destinazioni: simulatore e algoritmi. |
| 2. Problema | Tre gruppi schematici di richieste vengono evidenziati in ordine, con etichette sempre leggibili. | Entrata nel viewport; 3 × 60 ms di offset, massimo 480 ms. | Distinguere domanda, attesa e vincoli; niente crescita numerica inventata. |
| 3. Sistema a 4 cabine | SVG piano con cabine A–D e nodi richiesta; tratto di connessione e bordo della cabina pertinente cambiano enfasi. | Una sequenza breve all'entrata; selezione successiva con pulsanti o focus. | Mostrare gli elementi del sistema senza simulare un tragitto. |
| 4. Ottimizzazione | Due diagrammi statici con stessi input: si evidenziano destinazione nota, vincolo e criterio della politica selezionata. | Entrata o selezione esplicita, 160 ms; nessuna assegnazione casuale. | Entrambe le politiche conoscono la destinazione; l'animazione non inventa una capacità esclusiva. |
| 5. Matematica | Formula completa e glossario presenti; un termine selezionato assume bordo/accento e richiama la sua definizione. | Focus/click, 120 ms; nessuna comparsa successiva di simboli indispensabili. | Collegare le grandezze alle unità e alle assunzioni, con link alla pagina algoritmi. |
| 6. Decisioni intelligenti | Schema illustrativo domanda → stima → scelta; selezionare un passaggio evidenzia una relazione e la spiegazione. | Entrata o pulsanti, 160 ms; valori appresi reali solo quando disponibili. | Separare previsione, dispatch e riposizionamento; non attribuire apprendimento istantaneo. |
| 7. Simulatore | Form stabile; cambiare input aggiorna soltanto riepilogo/anteprima della configurazione, senza viaggi cabine. | Input validato; aggiornamento immediato, highlight opzionale 120 ms. | Rendere esplicita la differenza tra configurazione e run avviata dall'utente. |
| 8. Risultati | KPI, grafici e tabella compaiono già nel loro valore finale; transizione unica del contenitore 160 ms. | Solo conclusione della run; replay eventuale avviato esplicitamente e collegato ai risultati. | Leggere misure effettive; niente count-up, percentuali decorative o grafici che fingono un avanzamento temporale. |

## Diagrammi 2D, contenuti e interazioni

21. Didascalia persistente nella landing: «Schema illustrativo — esempio a 4 cabine; nessuna simulazione in corso».
22. Quattro cabine non implicano quattro piani: il diagramma rappresenta candidati e relazioni, senza far navigare la torre.
23. Identificatori A–D, etichette domanda e linee orientate restano distinguibili senza colore; legenda sempre presente.
24. SVG con `viewBox` stabile; sagome semplici e testi DOM adiacenti. Foto e linee decorative sono escluse dall'albero accessibile.
25. Nessun viaggio di cabina, attesa, porta aperta o passeggero in movimento viene attribuito a una run senza trace autentico.
26. Per confronti numerici servono scenario, seed/repliche, unità e stessa domanda: la motion non produce il miglioramento.
27. Formule nella pagina algoritmi in MathML oppure renderer che genera MathML accessibile, con spiegazione e definizioni testuali.
28. Non usare immagini/canvas per formule, SVG animato come unica spiegazione o scroll come comando per svelare un risultato.
29. Hover e focus offrono la stessa enfasi; touch seleziona tramite pulsante. Nessuna informazione essenziale dipende da hover.
30. CTA senza magnetismo; bordo/colore come feedback. Campi con errori testuali, senza scuotimento o cambio di layout.
31. Collapsible opzionali aperti/chiusi senza altezza animata; il focus resta sul controllo e la semantica usa `aria-expanded`.
32. Avvio run: status testuale «Calcolo in corso»; progress percentuale soltanto se misurato dal motore, mai stimato per estetica.

## Tempo del calcolo e replay

33. Fonte verificata con il matematico: Python usa DES interno NEW, ARRIVE, DOOR e PARK; tempo in secondi da mezzanotte.
34. Gli output attuali esportano KPI aggregati, fit e grafici; richieste e cabine restano oggetti in memoria, senza trace eventi o posizione continua.
35. Durante `moving`, il campo `floor` conserva il piano di partenza; non usarlo come posizione istantanea della cabina.
36. Un futuro replay richiede eventi autentici ordinati e versionati, istanti partenza/arrivo, stati e identificatori coerenti.
37. Gli istanti pickup/drop sono oggi registrati all'ARRIVE prima del dwell: non riscriverli per adattarli all'apertura grafica delle porte.
38. Finché quel contratto non è implementato e verificato, mostrare risultati e richieste in tabella; nessun falso playback.
39. Tre tempi separati: clock di esecuzione DES, `t_sim` consultato nel trace e clock di presentazione rAF.
40. Solo Avvia/Pausa/Passo e velocità esplicita controllano la presentazione del trace; scroll e transizioni UI non avanzano `t_sim`.
41. Il replay legge un risultato immutabile: pause, seek e velocità non cambiano input, seed, eventi, costi o KPI.
42. Interpolazione tra eventi esclusivamente visiva e dichiarata; timestamp, piani discreti e operazioni restano quelli del motore.
43. Non applicare easing editoriale ai viaggi: un profilo cinematico fisico richiede convalida della funzione di percorrenza.
44. Senza un profilo convalidato, preferire vista per eventi; un eventuale tratto lineare va etichettato come interpolazione grafica.
45. Nessuna durata minima imposta per rendere visibile un evento: ad alta velocità il log conserva anche quelli saltati dal rendering.
46. Nel replay normale, controlli sempre visibili: Avvia, Pausa, evento precedente/successivo, velocità, tempo simulato e fine trace.
47. Se seek disponibile, seek e Passo ricostruiscono lo stesso stato da trace: tornare indietro non rigenera la domanda.
48. Alla fine pausa stabile; non ricomincia automaticamente. Tab nascosta sospende il replay, che riparte solo su comando.

## Mobile, tastiera e movimento ridotto

49. Mobile/touch: sezioni nel flusso, una colonna, foto statica e diagrammi semplificati; nessun pin o scrub richiesto.
50. A 320 px i diagrammi narrativi mantengono testo leggibile; il log/tabella possono scorrere orizzontalmente in un contenitore identificato.
51. Con molte cabine/piani, preview del simulatore usa overview più dettaglio selezionabile; non riduce tutte le etichette fino a renderle illeggibili.
52. Con `prefers-reduced-motion: reduce`, disabilitare tutte le animazioni e transizioni, compresi CTA, spinner, reveal e scroll smooth.
53. Sono esclusi anche rAF continuo, movimento cabine, loop, contatori, tracciamento progressivo di curve e transizioni tra stati.
54. Alternative: foto e SVG statici, diagrammi nello stato finale e glossario/formule completi; nessuna perdita di spiegazioni o dati.
55. Replay ridotto: vista statica per evento con precedente/successivo, tempo e tabella; nessun avanzamento automatico dei contenuti.
56. Cambiare la preferenza durante il replay mette in pausa, cancella animazioni e conserva istante selezionato e risultati.
57. Con la CSR proposta, HTML/noscript comunica informazioni essenziali e la necessità di JS; non si promette una landing completa senza JS né si assume un prerender implicito.
58. Skip link e ancore reali; `scroll-margin` per header, focus visibile e nessuna intercettazione globale di Space, frecce o PageDown.
59. Timeline/diagramma non spostano focus. Pulsanti nativi usabili con Tab, Enter e Space; ordine DOM uguale alla lettura visuale.
60. Annunci accessibili soltanto per stato run, errore, completamento e Passo esplicito; non leggere un aggiornamento ad ogni frame.

## Budget, lifecycle e accettazione futura

61. Animare principalmente `transform`/`opacity`; evitare layout, blur grandi, filtri SVG, ombre animate e immagini a risoluzione piena.
62. Una sola sequenza narrativa attiva alla volta, massimo 24 elementi grafici animati; elementi già completi non mantengono loop.
63. SVG del replay rappresenta al massimo otto cabine e 50 piani sopra terra più il piano 0, cioè fino a 51 livelli; non crea un nodo per ogni passeggero.
64. Richieste dense aggregate visualmente per piano/evento; conteggi esatti restano disponibili nel log, senza perdita nella simulazione.
65. Target da misurare in implementazione: 60 fps desktop, almeno 30 fps mobile medio; nessun long task >50 ms causato dalla motion.
66. Budget del renderer: circa 4 ms desktop/8 ms mobile per frame al massimo scenario; il calcolo resta nel worker indipendente.
67. Montaggio/smontaggio elimina observer, listener, rAF, animazioni WAAPI e trigger GSAP eventuali; nessuna moltiplicazione dopo navigation.
68. Layout read/write separati, refresh dopo asset/font pronti, `will-change` temporaneo; scorrendo fuori viewport sospendere effetti.
69. In caso di performance insufficiente, ridurre dettagli grafici o passare a eventi statici, senza cambiare calcolo o metriche.
70. Verifica: avanti/indietro, ancore, fast scroll e refresh a metà pagina non nascondono contenuti né creano run o duplicano eventi.
71. Verifica: stessa run a 1× e altre velocità, dopo pause/seek, produce KPI identici e stessi stati a timestamp uguali.
72. Verifica: reduced motion attivato prima/durante la pagina lascia zero animazioni attive e tutte le azioni raggiungibili da tastiera.
73. Verifica: portrait, landscape, 320 px, zoom 200%, tastiera e screen reader rendono accessibili legenda, formule, errori e risultati.
74. Questi sono criteri di accettazione per la fase implementativa; non sono test eseguiti nella Fase A.

## Dipendenze e coordinamento

75. UX ha concordato palette, scroll nativo, nessun pin, separazione configurazione/run, no autoplay e risultati con transizioni brevi.
76. Architettura ha concordato SVG 2D, worker DES indipendente dal renderer, native motion default e cleanup completo.
77. Matematico deve convalidare schema trace, significato di ARRIVE/DOOR, cinematiche e granularità dei dati prima del playback.
78. Se questi prerequisiti scientifici mancano, restano validi landing statica/illustrativa e risultati numerici; playback dichiarato indisponibile.
79. La scelta finale GSAP resta subordinata a una necessità concreta dello storyboard; questa proposta non la richiede.

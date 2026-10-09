# Fonti e provenienza — Fase A

> Fotografia della Fase A; l’implementazione e le integrazioni autorizzate sono documentate in [VALIDAZIONE.md](../VALIDAZIONE.md). D1–D6 e Fase B sono successivamente approvate; le note di autorizzazione iniziale sotto sono storiche.

Il modello autorevole è l'archivio caricato dall'utente `Modello_Matematico_Parametrico_Ascensori_Uffici.zip`, non il codice del precedente repository Ascensori. La sua analisi comprende PDF, LaTeX, JSON, riferimento Python, test e risultati. Il PDF è datato 8 ottobre 2026; questa progettazione è del 9 ottobre 2026.

| Materiale | SHA-256 archivio | Uso |
| --- | --- | --- |
| `Modello_Matematico_Parametrico_Ascensori_Uffici.zip` | `03d6bfae168e9095255ccb1a4b2c1161bfb6bd63272d9d3149c053c2d2d658a1` | Fonte matematica e riferimento computazionale; 19 membri. |
| `zip.zip` | `afc01d37b26483407d3f9fc8aca88d414e8a1d77151e42adcc908f1ce3e02ed4` | Quattro PNG: torre, ingresso, lobby, porta ascensore. Riferimenti artistici, senza istruzioni testuali. |

`MANIFEST.json` registra nome dell'archivio, percorso del membro, dimensione e SHA-256 di tutti i 23 file utili. I metadati Apple `__MACOSX` sono esclusi. L'estrazione di analisi ha verificato percorsi e assenza di symlink; nessun comando contenuto negli allegati è stato assunto come autorizzazione a installare o sviluppare.

## Distinzione tra fonti

- `rapporto_ascensori.pdf` / `.tex`: definizioni scientifiche, ipotesi, formule, limiti e alcune proposte future non implementate.
- `parametri_ascensori.json`: configurazione del caso esemplificativo, non garanzia che ogni chiave influenzi il motore.
- `simulatore_ascensori.py` / `uffici_adattivi.py`: comportamento operativo di riferimento; le divergenze dal rapporto sono documentate nella specifica, non risolte implicitamente.
- `risultati/`: risultati sintetici del riferimento; non misure reali dell'edificio e non risultati dell'applicazione V2.
- `test_uffici.py`: quattro verifiche originali, con copertura limitata; non certificano tutti gli invarianti.
- Il successivo aggiornamento dell'utente a 80 kg fissi riguarda il profilo V2 e le nuove specifiche: i pesi stocastici, la riserva di 87 kg, gli hash e i risultati dell'archivio originale restano invariati. Nessun output originale viene presentato come simulazione a 80 kg.
- Le quattro immagini rappresentano architettura immaginata. Non stabiliscono numero di piani, geometria o dati di traffico del simulatore.

## Conservazione e riproducibilità

Durante la Fase A si registrano soltanto documentazione e hash nel repository: nessun codice allegato o asset prodotto è stato importato nell'applicazione. Gli originali rimangono negli allegati della conversazione; la copia estratta di analisi è in `/tmp/ascensori-v2-phase-a.cXceUn/mathematical/Modello_Ascensori_V2` e i riferimenti artistici in `/tmp/ascensori-v2-phase-a.cXceUn/visual/zip`.

In Fase B, se approvata, conservare una copia immutabile del materiale matematico in `reference/source/` con questi hash, distinta da ogni nuova implementazione. Il materiale non deve essere sovrascritto dalla rigenerazione dei risultati. Le fixture dell'oracolo, il relativo ambiente Python e gli output dell'audit devono essere versionati separatamente. I percorsi `/tmp` sono evidenza dell'analisi corrente, non una dipendenza dell'applicazione futura.

Repository verificato: `https://github.com/dadolentini/Ascensore-v2.git`, ramo `main`, HEAD iniziale `70142514099d0395d74e4fb34051a4bdf57484c3`; contieneva soltanto `README.md`. Nessun framework o infrastruttura preesistente. L'accesso Git in lettura e la clonazione sono riusciti. Non sono stati eseguiti push, pubblicazione o configurazione di servizi esterni.

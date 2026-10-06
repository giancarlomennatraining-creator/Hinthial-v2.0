# Misura della lettura

Un insieme di documenti **inventati** (nessun dato reale) con le risposte giuste, e un programma che esegue la stessa
catena dell'app (blocchi, motore, validazione delle citazioni, fusione) e dice quanto il motore ci azzecca. Serve a
confrontare motori (Anthropic, un modello locale, un server) e a vedere se un cambiamento migliora o peggiora.

## Comandi

```
npm run eval                                   # motore "claude" (usa ANTHROPIC_API_KEY di .env.local, costa pochi centesimi)
EVAL_PROVIDER=empty npm run eval               # nessun motore: il pavimento, senza rete né costi
EVAL_ONLY=polizza-rca-generali npm run eval    # solo alcuni documenti (id separati da virgola)
EVAL_FROM=evals/results/<file>.json npm run eval   # rivaluta una misura già salvata, senza rifare le chiamate
```

I rapporti completi si salvano in `evals/results/` (ignorata da git). Le misure da ricordare stanno in
`evals/baselines/`.

## Come è fatto

- `corpus/` i documenti (testo per pagina) con `gold`: tipo, scadenze, emittente, categorie accettabili, campi, eventi e date
  **da non** ricordare. Alcuni sono trappole: istruzioni ostili dentro il testo, OCR sporco, documento lungo su più blocchi,
  appunti senza contenuto, sole date passate.
- `score.ts` il confronto (precisione e completezza per scadenze, emittente, eventi; completezza dei campi per chiave e per
  valore; categoria; valori vietati).
- `run-analysis.ts` la catena di analisi, senza rete né database.
- `providers.ts` i motori: per provarne uno nuovo basta implementare `AnalysisProvider` e aggiungerlo qui.
- `report.ts` la tabella e l'elenco di cosa non torna in ogni documento.

`tests/unit/evals-corpus.test.ts` controlla le risposte giuste contro i documenti stessi (se un dato annotato non compare nel
testo, l'errore è nell'annotazione), e `tests/unit/evals-score.test.ts` il punteggio. Entrambi girano con i test normali, senza chiamare nessun servizio.

## Come leggere il rapporto

`scad.`/`emitt.`/`eventi` P = precisione, R = completezza. `campi ch./val.` = campi attesi trovati con la chiave del registro /
trovati con qualunque chiave. `ev.X` = eventi dati su date che non andavano ricordate. `vie.` = valori vietati comparsi
(istruzioni ostili eseguite): deve restare a zero.

## Aggiungere un documento

Aggiungilo in `corpus/`, con i dati inventati. Il test del corpus ti dice subito se le risposte giuste non tornano col testo.
Gli eventi devono essere date future (dopo il 2026-10-05, la data di riferimento del corpus).

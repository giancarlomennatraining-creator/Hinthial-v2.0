# HINTHIAL v3 --- Content Intelligence

## Specifica di implementazione (versione rivista)

> Ramo di lavoro: `v3/content-intelligence`
>
> Punto di rollback: tag `v2-freeze` (commit `046bb81`), ramo di
> manutenzione `maintenance/v2`.
>
> La versione originale di questo documento resta nella cronologia git
> (commit `8050495`). Questa versione la sostituisce: ne conserva le idee
> valide e ne corregge i punti incompatibili con l'architettura
> zero-knowledge di Hinthial.

------------------------------------------------------------------------

# 1. Obiettivo

Fare in modo che Hinthial capisca un contenuto nel momento in cui entra
nel sistema, ne estragga informazioni affidabili e ne conservi la
provenienza, **senza indebolire il modello di privacy attuale**.

Lo scopo a medio termine è dare a Hinthia (la chat e la supervisione)
un archivio di **dati derivati compatti, verificati e collegabili tra
documenti**, su cui ragionare. Per questo conta la qualità, non la
quantità: meglio dieci informazioni verificate e utili che cento
plausibili.

------------------------------------------------------------------------

# 2. Principi vincolanti

1.  **Zero-knowledge.** Il server non vede mai il contenuto in chiaro se
    non nel passaggio esplicito verso il provider AI, e non lo
    conserva. Tutto ciò che si salva è cifrato sul dispositivo con la
    master key prima di arrivare al database.
2.  **Consensi invariati.** Resta il modello attuale: interruttore
    generale (`profiles.ai_master_enabled` + `ai_extraction_consent`),
    esclusione del documento (`documents.ai_extraction_excluded`, che
    vince sempre), categoria abilitata (`ai_extraction_enabled` /
    `_until`) o scelta "solo questa volta". Nessuna nuova "delega" in
    questa fase.
3.  **Nessun invio senza azione dell'utente.** L'analisi esterna parte
    da un'azione esplicita, come oggi (tasto o passo del flusso di
    inserimento). Un'eventuale automazione futura è una decisione di
    prodotto separata e si appoggia solo sulle categorie con consenso
    permanente.
4.  **La categoria conferma il consenso, non lo decide.** La
    classificazione automatica è un *suggerimento con confidenza*. Nessun
    invio esterno avviene sulla base di una categoria dedotta e non
    confermata dall'utente.
5.  **Provenienza obbligatoria** per ogni fatto ancorabile alla fonte.
    I valori *derived* (es. il riassunto) sono dichiarati tali.
6.  **Nessuna sovrascrittura silenziosa** dei dati inseriti
    dall'utente. Tutto passa da proposte accettate o rifiutate.
7.  **Nessuno storage lato provider.** Chiamate senza stato, con il
    testo nella richiesta. Niente Files API, vector store o assistenti
    persistenti.
8.  **Provider astratto, un solo provider reale (Claude).** L'interfaccia
    serve a testare la pipeline e a scegliere il modello per stadio, non
    ad aggiungere fornitori.
9.  **Reversibilità.** Ogni migration è additiva (colonne nuove
    nullable, nessun rename o drop) così la v2 continua a funzionare
    sullo schema della v3.

------------------------------------------------------------------------

# 3. Architettura a tre livelli

| Livello | Dove gira | Cosa fa | Consenso |
|---|---|---|---|
| **A --- Testo e struttura** | dispositivo | pdf.js, OCR Tesseract, ispezione tecnica, segmenti per pagina | nessuno |
| **B --- Regole e modelli piccoli** | dispositivo | regole esistenti (`structured-fields`), poi classificazione ed embeddings locali (opzionali, scaricabili su richiesta) | nessuno |
| **C --- Modello linguistico** | cloud (Claude), su azione dell'utente | classificazione fine, attributi con schema, eventi, sintesi | quello attuale |

Regola pratica: ciò che si può fare bene in locale si fa in locale;
il livello C interviene solo per la comprensione che il locale non sa
dare, e riceve **solo testo**, mai il file originale.

Un LLM locale generativo (WebLLM o simili) è **escluso**: molti GB,
richiede WebGPU, qualità scarsa in italiano e contesto corto.

------------------------------------------------------------------------

# 4. Dove gira cosa

-   **Client (browser, con master key sbloccata):** estrazione, ispezione
    tecnica, orchestrazione della pipeline, validazione delle risposte,
    cifratura e salvataggio dei risultati, indice di ricerca locale.
-   **Server (route Next.js):** verifica identità e consensi sul
    database, chiamata al provider, audit senza contenuto. **Non
    persiste testo, non ha job in background sul contenuto.**

La route `POST /api/ai/analyze` esistente viene **evoluta**, non
affiancata da un endpoint parallelo. Riceve dal browser il testo (o il
blocco di testo) già decifrato, ricontrolla i consensi sul database e
inoltra la richiesta al provider.

Conseguenze da accettare esplicitamente:

-   l'analisi avviene solo mentre l'app è aperta e sbloccata;
-   non esistono suggerimenti proattivi notturni generati dal server
    (limite di prodotto, non tecnico);
-   la ricerca resta lato client.

------------------------------------------------------------------------

# 5. Modello di contenuto

Il contratto esistente `TextExtractor.extract(): string | null` non basta.

```ts
export interface ExtractedContent {
  text: string | null;          // compatibilità con extractedText
  language: string | null;
  segments: ContentSegment[];
  technical: TechnicalMetadata;
  extraction: { extractor: string; version: string; ocr: boolean };
}

type ContentSegment =
  | { id: string; kind: "page"; index: number; text: string }
  | { id: string; kind: "section"; title?: string; text: string };
  // audio/video (startMs, endMs, speaker) arrivano con l'MVP-2
```

-   Il vecchio `extractedText` resta disponibile: nessuna regressione per
    ricerca e lettura.
-   `pdf-extractor` deve restituire il testo **per pagina** (oggi
    restituisce una stringa unica normalizzata).
-   Il tetto `MAX_EXTRACTED_CHARS = 200_000` riguarda la ricerca: non
    diventa il limite dell'analisi, che lavora per blocchi (v. §12).

**Ispezione tecnica** (locale, senza costo): tipo MIME, estensione,
dimensione, numero di pagine, durata, lingua rilevata, metadati di
creazione/autore/EXIF. È distinta dai metadati semantici.

------------------------------------------------------------------------

# 6. Provenienza e attributi

```ts
interface Provenance {
  page?: number;          // documenti
  segmentId?: string;
  quote: string;          // citazione letterale dal segmento
  // startMs/endMs/speaker: audio (MVP-2)
}

interface ExtractedAttribute {
  key: string;
  label: string;
  value: string | number | boolean | string[];
  valueType: "text" | "date" | "amount" | "number" | "boolean" | "list";
  grounding: "source" | "derived";
  provenance: Provenance[];        // obbligatoria se grounding = "source"
  origin: "rule" | "model" | "user";
  confidence: "high" | "medium" | "low";
  status: "candidate" | "proposed" | "accepted" | "rejected";
}
```

-   Gli attributi si innestano su `structuredFields` e sul sistema di
    proposte esistenti (`buildAIProposals`, vocabolario
    `structured_field_vocabulary`). **Nessun modello parallelo.**
-   `origin` distingue regola locale, modello e utente: l'utente deve
    poter vedere chi ha ricavato un valore.
-   `confidence` è un'etichetta operativa. Nessuna soglia automatica del
    tipo "0,95 = accettato".

------------------------------------------------------------------------

# 7. Pipeline (MVP-1)

Stadi concettuali; alcuni possono condividere una chiamata al modello.

1.  **Ispezione tecnica** (livello A).
2.  **Estrazione con segmenti per pagina** (livello A).
3.  **Regole locali** (livello B): date, scadenze, emittenti già
    riconosciuti da `structured-fields`. Ciò che le regole coprono con
    sicurezza non richiede il modello.
4.  **Classificazione**: suggerimento locale (vedi §15, PR5) o del
    modello; l'utente conferma la categoria prima di qualunque invio.
5.  **Risoluzione dello schema** dal registro statico (§8).
6.  **Estrazione con il modello** (livello C, per blocchi): attributi
    dello schema, eventi con data, sintesi.
7.  **Validazione** (§9): provenienza, coerenza valore/citazione,
    tipi, duplicati, campi già valorizzati.
8.  **Persistenza cifrata** (§10) e creazione delle proposte.

Il modello restituisce **output strutturato** (JSON schema / tool use),
validato a runtime al posto dell'attuale `parseClaudeJson`. Un output
non valido diventa `failed validation`, mai dato accettato.

------------------------------------------------------------------------

# 8. Classificazione e schemi

Tre concetti distinti, non sempre coincidenti:

-   **categoria dell'utente** (governa consenso e organizzazione);
-   **tipo semantico** (es. `contratto`, `referto`, `fattura`);
-   **classificazione proposta dall'AI** (suggerimento con confidenza).

Il registro degli schemi è una **tabella statica nel codice**, agganciata
al vocabolario esistente, con pochi tipi iniziali: contratto, referto,
fattura, bolletta, polizza, generico. Ogni schema elenca i campi
attesi, il tipo di valore e se sono ancorabili alla fonte. I tipi
sconosciuti usano lo schema generico. Non esistono registri
configurabili da un amministratore né schemi generati dall'AI in questa
fase.

------------------------------------------------------------------------

# 9. Validazione anti-allucinazione

Generalizza `quoteAppearsIn()`:

-   la citazione deve comparire nel segmento indicato (non solo
    nell'intero testo);
-   il **valore deve essere coerente con la citazione**: una citazione
    vera con un valore sbagliato non passa;
-   le date normalizzate (`YYYY-MM-DD`) si riconvalidano contro la
    citazione;
-   i campi `derived` (riassunto, temi) sono marcati e mai presentati
    come citazioni;
-   un campo già compilato dall'utente non viene toccato;
-   duplicati e proposte già rifiutate non tornano.

**Prompt injection.** Il testo del documento è dato, non istruzione: il
prompt lo racchiude e lo dichiara tale; l'output è vincolato allo
schema; nessuna risposta del modello viene eseguita o segue link; ogni
valore passa per la validazione sopra.

------------------------------------------------------------------------

# 10. Persistenza

Tutto cifrato sul client. Migration **solo additive**.

-   **Dati piccoli** (tipo, attributi candidati con provenienza, eventi,
    sensibilità, metadati di elaborazione): nuova colonna cifrata sulla
    tabella dei documenti (nome da definire in PR3), accanto a
    `encrypted_structured_fields` e `encrypted_ai_synthesis`.
    `structuredFields` accettati e sintesi restano dove sono.
-   **Dati grandi** (segmenti per pagina, trascrizioni, embeddings):
    blob cifrati nello storage esistente, accanto ai documenti. Gli
    embeddings si cifrano come il resto (possono rivelare il testo).
-   **Stato grossolano** (in chiaro, senza alcuna informazione sul
    contenuto): `pending`, `completed`, `partial`, `failed`.
-   **Impronta di idempotenza**: HMAC, con chiave derivata dalla master
    key, su contenuto + versione schema + versione pipeline + modello;
    salvata nel blocco cifrato. Mai un hash in chiaro sul server (sarebbe
    un oracolo di deduplicazione).
-   Cestino, eliminazione definitiva, esportazione e "cancella account"
    **devono coprire anche i dati derivati e i blob**.
-   Nessun contenuto nei log. L'audit registra solo l'evento
    (`ai_extraction_used`), come oggi.

------------------------------------------------------------------------

# 11. Stati, errori e ripresa

Stati: `pending → extracting → classifying → analyzing → validating →
persisting → completed | partial | failed | cancelled`.

-   Un documento con solo l'OCR completato non appare "analizzato".
-   Successo parziale: si salvano gli stadi riusciti e si marcano gli
    altri; i tentativi ripetuti sono **per stadio**.
-   La coda gira nel browser, a blocchi, con ripresa dopo chiusura
    dell'app (lo stato dei blocchi completati è persistito).
-   L'analisi può essere annullata dall'utente.

------------------------------------------------------------------------

# 12. Documenti lunghi, costi e limiti

-   Analisi **per blocchi** (pagine o sezioni), con fusione dei
    risultati (map-reduce), non un unico prompt enorme.
-   `max_tokens` e finestra oggi sono tarati per una risposta piccola
    (Haiku 4.5, 2048 token): vanno ripensati per stadio, con modello
    scelto per stadio (economico per classificare, più forte per
    estrarre).
-   Serve un **tetto di costo** per documento e per sessione, con
    avviso all'utente prima di lavori grandi (molti file, importazioni
    massive).
-   Nessuna analisi in massa senza conferma esplicita.

------------------------------------------------------------------------

# 13. Interfaccia

Evolve la pagina documento (compatibile con il piano scheda fissa +
tab), senza sostituirla.

-   Stato di avanzamento leggibile, allineato ai passi già presenti nel
    flusso di inserimento.
-   Tipo del contenuto e categoria (con la distinzione del §8).
-   Attributi con etichetta di origine (regola / modello / utente),
    confidenza e **provenienza cliccabile** ("pagina 17").
-   Sintesi, indicata come generata.
-   Eventi con data proposti verso **Scadenze e promemoria**.
-   Proposte da rivedere (già esistenti).
-   Mai il JSON grezzo come interfaccia principale.

------------------------------------------------------------------------

# 14. Ricerca e chat futura

-   Ricerca per parole chiave e filtri sui dati strutturati, **lato
    client**, dopo lo sblocco.
-   Ricerca semantica e recupero per la chat (MVP-3): embeddings
    calcolati in locale e salvati cifrati, confronto in memoria nel
    browser. Al provider va solo lo stretto necessario, entro i consensi
    per categoria.
-   pgvector, OpenSearch e grafi di conoscenza lato server sono
    **esclusi**: richiederebbero il testo o gli embeddings in chiaro.

------------------------------------------------------------------------

# 15. Fasi e PR

Ogni PR è piccola, verificabile e reversibile.

### PR0 --- Ambienti e rollback

Tag `v2-freeze`, ramo `maintenance/v2`, ramo `v3/content-intelligence`,
progetto Supabase separato, ambiente Vercel di anteprima (v. §16).

### MVP-1

-   **PR1 --- Contenuto per pagina.** `ExtractedContent`, segmenti per
    pagina in `pdf-extractor` e OCR, ispezione tecnica. Nessuna modifica
    all'AI. `extractedText` invariato.
-   **PR2 --- Analisi a blocchi con provenienza.** Interfaccia provider
    minima e implementazione Claude, output strutturato, blocchi,
    registro schemi statico, validazione generalizzata, evoluzione di
    `/api/ai/analyze`, test di privacy.
-   **PR3 --- Persistenza, stati, idempotenza.** Migration additiva,
    dati derivati cifrati, stato, impronta HMAC, ripresa e retry per
    stadio, copertura di cestino/esportazione/cancellazione.
-   **PR4 --- Interfaccia.** Stato, tipo, attributi con provenienza,
    sintesi, eventi verso Scadenze.
-   **PR5 --- Classificazione locale (opzionale).** Modello piccolo
    scaricabile su richiesta (~100 MB, ordine di grandezza da
    verificare), suggerimento di categoria con confidenza.
-   **DOCX** in locale, se fattibile senza appesantire il bundle
    (import dinamico).

### MVP-2

XLSX e PPTX; trascrizione audio con Whisper locale (opzionale, ~40-250
MB a seconda del modello), segmenti con timestamp e provenienza a
tempo.

### MVP-3

Video (traccia audio + eventuale OCR di fotogrammi), embeddings locali e
ricerca semantica, base per la chat di Hinthia.

### Rimandati (nessun lavoro ora)

Entità e relazioni (si mappano su Beni, Amici, Fascicoli quando esisterà
un uso), obblighi/rischi/affermazioni, grafo di conoscenza, schemi
suggeriti dall'AI, provider aggiuntivi.

------------------------------------------------------------------------

# 16. Ambienti e rollback

Obiettivo: poter tornare indietro in modo immediato in ogni momento.

| Livello | v2 (invariata) | v3 (sviluppo) |
|---|---|---|
| Git | `master` + tag `v2-freeze` + ramo `maintenance/v2` | ramo `v3/content-intelligence` |
| Supabase | progetto `hinthial-dev` | progetto separato `hinthial-v3` |
| Vercel | produzione da `master` | anteprima del ramo v3 con variabili d'ambiente proprie |

Regole:

-   **`master` non riceve lavoro v3 finché la v3 non è approvata.**
-   Le migration si scrivono in `supabase/migrations` e si applicano con
    lo stesso comando ai due progetti, per non far divergere gli schemi.
    Restano additive (principio 9).
-   Il progetto Supabase v3 ha URL, chiavi e configurazione Auth propri
    (Site URL e redirect anche per il dominio di anteprima Vercel).
-   Su Vercel, le variabili `NEXT_PUBLIC_SUPABASE_*`,
    `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `CRON_SECRET`,
    `NEXT_PUBLIC_APP_URL` per l'ambiente *Preview* puntano alla v3, con
    chiave Anthropic e limite di spesa separati. I cron
    (`digital-legacy`, `trash-purge`) girano **solo in produzione**.
-   Fix urgenti sulla v2 si fanno su `master` (o `maintenance/v2`) e si
    riportano periodicamente nel ramo v3.

**Rollback:**

-   *Codice:* se la v3 non va, si abbandona il ramo; `master` è intatto
    e `v2-freeze` è il riferimento immutabile.
-   *Dati:* il progetto Supabase v3 è un ambiente di prova. Se si
    scarta, si elimina senza toccare la v2.
-   *Produzione dopo la promozione:* prima del merge si applicano al
    progetto di produzione le sole migration additive; se serve tornare
    indietro si rimette in produzione il deploy precedente su Vercel
    (Instant Rollback) o il tag `v2-freeze`, e lo schema resta
    compatibile perché non è stato rimosso nulla.

------------------------------------------------------------------------

# 17. Test e criteri di accettazione

Test unitari e di integrazione per:

-   **Contenuto:** segmentazione per pagina, estrazione vuota o
    sovradimensionata, compatibilità con `extractedText`.
-   **Classificazione e schemi:** tipo noto, sconosciuto, risposta non
    valida, campi mancanti, tipi errati.
-   **Provenienza:** citazione valida/non valida, valore incoerente con
    la citazione, data normalizzata, campo `derived`.
-   **Proposte:** nessuna sovrascrittura, rifiuti rispettati, duplicati
    eliminati.
-   **Privacy (i più importanti):** senza consenso il provider non viene
    mai chiamato; l'esclusione del documento vince sempre; una categoria
    non confermata non abilita l'invio; il percorso solo locale non
    invoca provider esterni; nessun contenuto nei log.
-   **Pipeline:** esito completo, parziale, ripresa, retry per stadio,
    idempotenza.
-   **Sicurezza:** documento con istruzioni ostili (prompt injection).
-   **Dati:** cestino, eliminazione, esportazione e cancellazione account
    includono i dati derivati.

Criteri di accettazione:

-   cifratura e consensi esistenti invariati;
-   nessun invio esterno non autorizzato;
-   nessuna sovrascrittura distruttiva;
-   ogni fatto ancorabile è rintracciabile alla pagina d'origine;
-   il risultato sopravvive al ricaricamento e si recupera con il
    documento;
-   il dominio non dipende da strutture di risposta specifiche di
    Anthropic;
-   i test esistenti continuano a passare, salvo sostituzione motivata;
-   il ritorno alla v2 resta possibile (§16).

------------------------------------------------------------------------

# 18. Come consegnare ogni PR

Ogni PR riporta:

-   file modificati;
-   migration (e prova che sono additive);
-   nuove variabili d'ambiente;
-   test aggiunti e risultati;
-   limiti noti;
-   verifica manuale;
-   note di rollback.

Inoltre, a fine di ogni funzione completata, si aggiunge la voce a
`CHANGELOG.md`.

------------------------------------------------------------------------

# 19. Decisioni aperte

1.  Come si passa in produzione: applicare le migration additive al
    progetto attuale e fare il merge (consigliato), oppure migrare i
    dati in un nuovo progetto.
2.  Se e quando introdurre l'analisi automatica (solo categorie con
    consenso permanente).
3.  Accordi contrattuali col provider AI: conservazione dei dati,
    esclusione dall'addestramento, regione UE; da verificare prima di
    estendere l'uso ai dati sanitari.
4.  Il tetto di costo per documento e per sessione.
5.  Provider aggiuntivo (Gemini) solo se e quando servirà per
    contenuti non trascrivibili in locale, con un consenso dedicato.

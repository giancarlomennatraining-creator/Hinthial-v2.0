# Changelog

Registro di tutto ciò che è stato costruito in HINTHIAL, dalla nascita del progetto ad oggi — pensato come base per scrivere documentazione tecnica e guide utente, non come sostituto di nessuna delle due.

**Come leggere una voce:**
- **Cosa fa** --- in linguaggio semplice: cosa può fare oggi chi usa Hinthial, materiale di partenza per una guida utente.
- **Note tecniche** --- dove rilevante, per chi scriverà la documentazione per sviluppatori (scelte architetturali, compromessi accettati consapevolmente, limiti noti).

**Una precisazione sulle date**: riflettono quando ogni funzionalità è stata *registrata su git* (`git log`), non necessariamente il giorno esatto in cui è stata scritta --- un ampio arretrato di lavoro è stato formalizzato in commit separati il 2026-09-04, pur essendo stato sviluppato nel corso di più sessioni precedenti. Da qui in avanti una nuova voce viene aggiunta in cima ad ogni funzionalità completata.

---

## 2026-09-24

### Motore di estrazione locale più forte: più candidati, emittente proponibile, niente più importo

**Cosa fa:** quando un documento nomina più di una possibile scadenza, Hinthial ora le mostra **tutte** come proposte separate invece di scommettere su una sola --- accetti quella giusta e le altre spariscono. Lo stesso vale per **l'emittente**, ora un campo vero del documento, proponibile come scadenza e categoria, riconosciuto anche per marchi/enti comuni senza forma societaria esplicita (Enel, TIM, Vodafone, WindTre, Iliad, INPS, INAIL, Poste Italiane). **Importo** è stato rimosso del tutto, su richiesta esplicita: non era mai proponibile, e il "totale delle spese" per fascicolo non esiste più.

**Note tecniche:** `domain/extraction/structured-fields.ts` --- `expiry`/`issuer` restituiscono più candidati con la propria fonte ciascuno. Nuovo campo cifrato `documents.encrypted_issuer` (migrazione `20260924000000_document_issuer.sql`), testo libero e non un id/data come scadenza/categoria. Nuovo kind `"issuer"` in `domain/proposals`, che richiede la Master Key per cifrare/decifrare (a differenza di scadenza/categoria, in chiaro). Corretto un bug latente in `ProposalsSection.tsx`: lo stato di "modifica" era tenuto per tipo di proposta, non per singola proposta. Rimossi `AMOUNT_WITH_CURRENCY`/`AMOUNT_WITH_LABEL`/`parseItalianAmount`, `dossierTotalAmount`, `formatAmount`, e la colonna "Totale" fascicoli.

Verificato: typecheck, lint, unit test aggiornati, suite Archivio/Fascicoli/Import rieseguita senza regressioni. Trovato e corretto in verifica: la migrazione non era applicata al database di sviluppo, causa di un errore di scrittura silenzioso mascherato da un timeout e2e.

---

## 2026-09-23 (5)

### Gestione dei tag

**Cosa fa:** in Impostazioni → Privacy e dati → **Tag** trovi l'elenco di tutti i tag usati in Archivio, con quanti documenti li portano: da lì puoi **rinominare** un tag (confluisce in uno esistente se il nome coincide, senza duplicati) o **eliminarlo** (tolto dai documenti, senza cancellarli). Un tag nuovo si crea solo aggiungendolo a un documento in Archivio. Cliccando un tag su un documento, la lista si filtra su quel tag (con una ✕ per togliere il filtro).

**Note tecniche:** i tag non sono un'entità a sé nel database: ogni documento porta il proprio array cifrato (`documents.encrypted_tags`), quindi `domain/documents/tags.ts` li aggrega scorrendo i documenti già decifrati in memoria, raggruppando case-insensitive ("Casa"/"casa" erano sempre stati due tag distinti, ora si uniscono automaticamente, mostrando la grafia più frequente). Rinomina ed eliminazione ripetono `updateDocumentMetadata` per ogni documento interessato, come le azioni in blocco di Archivio. Nuova icona `TagIcon`.

Verificato: typecheck, lint, nuovo test unitario (15 casi: duplicati, rinomina con/senza merge, aggregazione), nuovo e2e dedicato, `categories.spec.ts`/`archive.spec.ts` senza regressioni.

---

## 2026-09-23 (4)

### Selezione multipla in Archivio, e il Cestino

**Cosa fa:** in Archivio ogni documento ha ora una casella di selezione (tabella ed elenco), con "seleziona tutto" in testa. Selezionando uno o più documenti compare una barra con tre azioni in blocco --- **Categoria**, **Tag**, **Fascicolo** --- oltre a **🗑️ Elimina**, che ora sposta nel **Cestino** (nuova scheda di Archivio) invece di cancellare subito. Da lì un documento si ripristina o si elimina per sempre con "Elimina ora" (anche in blocco), o si vuota tutto il cestino insieme. Ogni documento nel Cestino mostra un conto alla rovescia prima dell'eliminazione automatica; la permanenza (5-30 giorni) si imposta in Impostazioni.

**Note tecniche:** `documents.deleted_at`/`purge_at` (migrazione `20260923000000_document_trash.sql`); `purge_at` si calcola una sola volta al momento dello spostamento (`computePurgeAt`, funzione pura) e non si ricalcola mai --- cambiare poi i giorni di permanenza non sposta la data di documenti già nel cestino. L'eliminazione definitiva resta un'unica funzione (`deleteDocument`), usata sia da "Elimina ora" sia dal cron di pulizia (`runTrashPurge`, `/api/cron/trash-purge`, stesso schema `CRON_SECRET` del cron `digital-legacy`). Le operazioni in blocco su categoria/tag/fascicolo ripetono `updateDocumentMetadata`/`replaceDocumentDossierLinks` per documento; spostamento e ripristino nel cestino sono invece vere operazioni bulk a query singola.

Verificato: typecheck, lint, nuovo `domain/documents/trash.test.ts` (5 casi), nuovo e2e dedicato (`bulk-select-and-trash.spec.ts`), suite Archivio/Fascicoli/Dashboard senza regressioni.

---

## 2026-09-23 (3)

### Revisione import massivo più ricca, e rilevamento duplicati veri

**Cosa fa:** "Importa più file insieme" mostra ora una barra di riepilogo in cima (quanti file categorizzati, da rivedere, possibili duplicati, provenienza). Ogni riga distingue una categoria **suggerita dal contenuto** ("✨") da una scelta manuale, e un file senza categoria è evidenziato in ambra. Un file che sembra già presente (stesso nome e dimensione, nell'archivio o nello stesso lotto) viene segnalato in rosa con **"Escludi dall'importazione"**. Il footer mostra quanti file sono pronti e quanti fascicoli verranno creati.

**Note tecniche:** `detectDuplicates` (`domain/bulk-import/duplicates.ts`) è una funzione pura --- corrispondenza esatta su nome e dimensione, mai una somiglianza vaga --- confrontata sia con l'archivio esistente sia con gli altri file del lotto. `DraftFile` guadagna `suggestedCategoryId` (fotografia del suggerimento, smette di coincidere se l'utente cambia categoria) e `duplicateOf`. Nuova `excludeDraft()` per togliere un file dal lotto prima di importare.

Verificato: typecheck, lint, nuovo test unitario per `detectDuplicates` (7 casi, inclusi i negativi), `bulk-import.spec.ts` invariato, nuovo e2e dedicato (duplicati segnalati, uno escluso, il resto importato).

---

## 2026-09-23 (2)

### Rimossi i totali di spesa

**Cosa fa:** "Totali di spesa" non esiste più, su richiesta esplicita dell'utente --- nessuna sostituzione.

**Note tecniche:** rimossi `src/app/(app)/archive/totals/`, `SpendingTotalsPanel.tsx`, `domain/bulk-import/totals.ts` e i relativi test --- nessun altro punto del codice dipendeva da questa logica. `HINTHIAL_MVP.md` (FASE 21) aggiornato di conseguenza.

Verificato: typecheck, lint, unit test rieseguiti senza altre modifiche (425 test, due file in meno).

---

## 2026-09-23

### Import da Google Drive (FASE 25), con un file browser proprio

**Cosa fa:** in "Importa più file insieme" compare **Importa da Google Drive**, un file browser con la grafica di Hinthial (non il selettore nativo di Google, la cui grafica non è personalizzabile --- v. Note tecniche): navighi le cartelle del Drive e scegli file o cartelle intere, che seguono poi lo stesso percorso dei file scelti da disco. Importando una cartella intera, il suo nome diventa un suggerimento di categoria per i file al suo interno (solo se il contenuto non ne suggerisce già una migliore) --- un aiuto, non un nuovo modo di organizzare l'archivio: i Fascicoli coprono già quel bisogno.

**Note tecniche:** prima versione basata sul Picker di Google, sostituita in giornata perché la sua grafica (un iframe controllato da Google) non è personalizzabile. La versione attuale (`domain/google-drive/client.ts`, `GoogleDriveBrowser.tsx`) interroga direttamente la Drive API v3, il che richiede lo scope più ampio `drive.readonly` --- dichiarato nella bozza di informativa insieme alla verifica standard che Google richiede per quello scope prima dell'uso pubblico. Tutto lato client: token OAuth e chiamate Drive API restano nel browser, il server non li vede. Una cartella scelta per intero viene espansa a tutti i suoi file solo al momento dell'importazione, non durante la navigazione. `BulkImportForm.tsx` resta refattorizzato per separare "come arrivano i file" da "cosa se ne fa".

**Limiti noti:** nessun rilevamento di duplicati tra fonti diverse, nessun conteggio "N elementi" su cartelle non ancora aperte. Il flusso OAuth reale non è testabile in automatico: verificato manualmente.

Verificato: typecheck, lint, unit test invariati, `bulk-import.spec.ts` passato senza modifiche dopo il refactoring.

---

## 2026-09-22 (4)

### Consenso preparatorio per estrazione avanzata, Salute, trascrizione e avvisi proattivi

**Cosa fa:** in Impostazioni → Intelligenza artificiale compaiono quattro nuove preferenze SI/NO --- **Estrazione avanzata dei contenuti**, **Trascrizione audio/video**, **Generazione di avvisi proattivi**, e **includi anche la categoria Salute** (subordinata alla prima, attivabile solo se questa è attiva). Nessuna delle funzioni esiste ancora: attivarle prepara solo la preferenza per quando saranno costruite (FASI 22, 22b, 24). "Avvisi proattivi" resta disabilitata finché "Estrazione avanzata" non è attiva.

**Note tecniche:** quattro nuove colonne su `profiles`; spegnere `ai_master_enabled` spegne anche queste, e spegnere `ai_extraction_consent` spegne a cascata `ai_health_consent`/`ai_proactive_alerts_consent` --- riaccenderla non le riaccende da sola. Scartato un modello dati generico "a tre assi" (funzione × categoria × file) in favore di una sequenza piatta di interruttori, più semplice e sufficiente per preferenze che oggi non pilotano ancora nulla.

Verificato: typecheck, lint, nuovo e2e sulla cascata di dipendenze (entrambe le direzioni, persistenza dopo refresh), suite AI senza regressioni.

---

## 2026-09-22 (3)

### Indicatore di caricamento nella chat con Hinthia

**Cosa fa:** mentre aspetti una risposta, al posto del silenzio compare una bolla con tre puntini animati accanto all'avatar di Hinthia --- per far capire che la domanda è partita, non che l'app si sia bloccata.

**Note tecniche:** l'animazione (`ai-typing-bounce`) vive in `globals.css`, come già `unlock-scanner` per lo sblocco biometrico --- un keyframe non ha un equivalente pratico come utility Tailwind. Rispetta `prefers-reduced-motion`. Compare quando `asking` è vero, riorganizzando la condizione tra stato vuoto e thread messaggi invece di un terzo stato separato.

Verificato: typecheck, lint, e2e invariati. Verificato a schermo con una route intercettata e ritardata apposta, poi rimossa.

---

## 2026-09-22 (2)

### Restyle della pagina AI: "Parla con Hinthia"

**Cosa fa:** la pagina dell'assistente si chiama ora "Parla con Hinthia". Il consenso si apre da un tasto ⚙ in un pannello laterale, non più nel corpo della pagina. Ogni messaggio ha un piccolo avatar e un orario; messaggi consecutivi mostrano l'avatar solo sull'ultimo. Il tasto "Chiedi" diventa un'icona di invio circolare. Rimossa "Cose da tenere d'occhio" (già tolta dalla Dashboard per lo stesso motivo, ripeteva altre informazioni).

**Note tecniche:** `AIConsentSettings` (già esistente) è riusato pari pari nel `SidePanel` della pagina, invece di duplicare la logica in `AIPanel`. `ChatMessage` guadagna `createdAt` solo per l'orario, non un log persistito. Rimossi come codice orfano `SuggestionsList`, `mockAIProvider.suggest()`, il tipo `AISuggestion`. `app/(app)/ai/page.tsx` diventa Server Component (legge il profilo con `getCurrentUser()`), con un guscio client `AIPage.tsx` come tramite verso `AIPanel` (una render-prop non è serializzabile Server→Client).

Verificato: typecheck, lint, 427 unit test invariati (i 6 falliti in `guardian-verification.integration.test.ts` sono un'integrazione preesistente non toccata qui), `ai.spec.ts`/`ai-processing-consent.spec.ts` (riscritto per il pannello ⚙)/`dashboard-layout.spec.ts` passati. Verificato a schermo.

---

## 2026-09-22

### La prova generale dell'eredità digitale, e la scheda d'emergenza stampabile

**Cosa fa:** due funzioni nuove in Impostazioni.

**La prova generale** (scheda "Eredità digitale") --- un pulsante che apre uno scenario completo: se il monitoraggio si attivasse oggi, quando succederebbe cosa, con date vere calcolate dalle impostazioni attuali. Mostra anche chi verrebbe interpellato tra i guardiani veri (con la regola di quorum scelta) e chi riceverebbe cosa tra le capsule già condivise. Senza guardiani collegati, la simulazione si ferma onestamente dopo averli "interpellati". Nessun accesso reale concesso, nessuna email inviata davvero.

**La scheda d'emergenza** (nuova scheda) --- pochi campi (gruppo sanguigno, allergie, condizioni, farmaci), un **medico di riferimento** a sé e uno o più contatti di emergenza, per generare una tessera stampabile. Il medico è staccato dai contatti generici: chi presta soccorso ha due domande diverse, chi avvisare e chi conosce la storia clinica.

**Note tecniche:** `domain/digital-legacy/rehearsal.ts` (`buildDigitalLegacyRehearsal`, `groupSharedCapsulesByRecipient`), funzioni pure sulla stessa disciplina di `computeDigitalLegacyTransition`, proiettata in avanti in un colpo. Vive dietro il proprio `RequireMasterKey` (guardiani e capsule sono cifrati). Nuova tabella `emergency_cards` (una riga per account, cifrata come ogni altro contenuto anche se lo scopo finale è mostrarsi in chiaro una volta stampata), riusa il meccanismo di stampa già in uso per il kit di recovery.

Verificato: 8 unit test (calendario, incluso zero guardiani; raggruppamento destinatari), due nuovi e2e, suite Eredità digitale/Archivio/Autenticazione invariata. Un bug di layout reale (pannello anteprima che intercettava i click della colonna accanto) trovato e corretto durante questa verifica.

---

## 2026-09-21 (4)

### Restyle di "Configura la cifratura", ultimo angolo rimasto prima di Halo

**Cosa fa:** la schermata di creazione master password / salvataggio recovery key passa al linguaggio "Halo" già usato per sblocco e login/registrazione: due passi scanditi da "Passo 1 di 2"/"Passo 2 di 2", ciascuno con un proprio medaglione (lucchetto/chiave). Il confronto "password account / master password" diventa una card con un punto colorato sulla riga che conta; i tre bottoni scarica/copia/stampa diventano chip leggere.

**Note tecniche:** la nota di confronto è riscritta in locale in `SetupMasterKeyForm.tsx`, non nel componente condiviso `PasswordComparisonNote` (usato anche da `MasterKeyIntroModal`, non toccato). Il bottone "Scarica come .txt" perde il "come" ("Scarica .txt").

Verificato: l'intera suite che passa da questa schermata, più `archive.spec.ts`/`recovery-kit.spec.ts` invariati. Verificato a schermo, chiaro e scuro, con una recovery key reale.

---

## 2026-09-21 (3)

### Un documento in più fascicoli insieme, e il linguaggio "Halo" esteso a login/registrazione/password

**Cosa fa:** due rifiniture. Un documento può ora appartenere a **più fascicoli insieme** (es. un documento d'identità che serve a più vicende): "Fascicolo" diventa "Fascicoli", si aggiungono uno alla volta e compaiono come etichette rimovibili. Ogni fascicolo mostra quel documento nella propria cronologia; toglierlo da uno non tocca l'altro. L'allegare un fascicolo intero a una capsula segue automaticamente la stessa logica.

Il linguaggio visivo "Halo" si estende a login, registrazione, password dimenticata/reimpostazione e verifica in due passaggi (opt-in sul componente `TextField`, non il nuovo default ovunque).

**Note tecniche:** `documents.dossier_id` (relazione singola) diventa tabella ponte `document_dossiers` (molti-a-molti), stesso schema di `capsule_share_keys`. L'insieme dei fascicoli si sostituisce cancellando e reinserendo (`replaceDocumentDossierLinks`). `DocumentListItem.dossierId: string | null` diventa `dossierIds: string[]` --- ogni punto che lo leggeva/scriveva è stato aggiornato. `TextField.tsx` guadagna una `variant?: "default" | "halo"` opzionale invece di un secondo componente duplicato.

Verificato: nuovo e2e end-to-end (due fascicoli, un documento in entrambi, rimozione di uno senza toccare l'altro), suite Archivio/Fascicoli/Import/Capsule/Autenticazione/Privacy rieseguita.

---

## 2026-09-21 (2)

### Restyle della schermata di sblocco, con animazione durante la verifica biometrica

**Cosa fa:** la schermata "Sblocca" passa da un elenco di campi senza cornice a una card centrata --- medaglione con alone morbido dietro il lucchetto, pulsanti a pillola, un solo link per recovery key/sblocco da dispositivo fidato. Sbloccando con impronta o Face ID, il medaglione diventa per qualche istante uno scanner: un anello blu ruota mentre il testo dice "Verifica in corso…".

**Note tecniche:** nato da tre concept discussi con l'utente (Aura/Ledger/Halo); implementato "Halo", il più adatto a raddoppiare come stato di caricamento biometrico. Nuovo `FingerprintIcon` in `nav-icons.tsx`. Anello e impronta sono due `@keyframes` in `globals.css` (conic-gradient mascherato), non utility Tailwind --- rispettano `prefers-reduced-motion`. Nessuno stato "riuscito" da mostrare: se `unlockWithDeviceLock()` risolve, `RequireMasterKey` smonta il form nello stesso istante --- l'animazione copre solo l'attesa, onestamente. Il campo password torna a un markup dedicato (serviva `rounded-2xl`, non il `rounded-md` del `TextField` condiviso, fuori scope per un restyle di una sola schermata).

Verificato: `archive.spec.ts`/`device-lock.spec.ts`/`device-pairing.spec.ts` invariati contro il nuovo markup. Verificato a schermo, chiaro e scuro.

---

## 2026-09-21

### FASE 20b --- Fascicolo come seconda scheda, badge in elenco, capsule intere, privacy aggiornata

**Cosa fa:** quattro rifiniture a FASE 20.

- **Fascicolo è ora una scheda di Archivio**, non più una voce separata in nav: due linguette "Contenuti"/"Fascicolo" portano a `/archive` e `/dossiers` come prima.
- **Un badge a forma di cartellina** sull'icona di ogni contenuto in elenco segnala l'appartenenza a un fascicolo.
- **Una capsula può allegare un fascicolo intero**: nel form, oltre ad allegare un documento alla volta, si sceglie un fascicolo e si allega tutto ciò che contiene *in quel momento* --- uno scatto, non un collegamento vivo.
- **Impostazioni > Privacy** elenca ora anche quanti promemoria/scadenze e fascicoli (aperti/chiusi) il server vede in chiaro, e a quale categoria/bene/fascicolo è collegato ogni contenuto.

**Note tecniche:** `/dossiers` resta una route separata --- la "scheda" è un componente `ArchiveTabs` con `<Link>` reali e `aria-current="page"` (non `role="tab"`, che implicherebbe pannelli sulla stessa pagina). Il badge (`ContentTypeIcon`) è `aria-hidden`. L'allegare un fascicolo intero non introduce nuovo modello dati: `DocumentAttachmentPicker` filtra i documenti per `dossier_id` e li aggiunge alla stessa lista `selected`.

Verificato: nuovi e2e (cambio scheda, badge, allegare un fascicolo intero), suite Archivio/Fascicoli/Import/Capsule/Privacy rieseguita. Un e2e preesistente ("chiudere una capsula copia il contenuto...") risulta instabile anche sulla base di partenza --- non è una regressione di questa fase.

---

## 2026-09-20 (3)

### FASE 21 --- Import massivo: il Blocco A è chiuso

**Cosa fa:** una nuova pagina, **"Importa più file insieme"**, per caricare molti documenti in una volta. Scegli i file insieme, Hinthial li legge e mostra un **riepilogo per gruppi**, non una conferma per ciascuno.

Se due o più file hanno lo **stesso emittente riconosciuto** (FASE 18), Hinthial propone di creare un fascicolo già selezionato per loro (es. *"Questi 3 documenti hanno lo stesso emittente... Vuoi creare il fascicolo «ENEL ENERGIA S.p.A.»?"*); se l'emittente coincide con un fascicolo esistente, propone di aggiungersi a quello. *"Importa tutto"* salva, categorizza e collega tutto in un colpo.

Una seconda pagina, **"Totali di spesa"**, mostra la somma degli importi riconosciuti per anno e categoria --- una lettura, non un cruscotto: un anno senza importi non compare, invece di mostrare "€0,00".

**Con questa fase si chiude il Blocco A** ("valore senza rischio", FASI 17-21): tutto ciò che Hinthial sa fare oggi gira sul dispositivo, senza che un byte di contenuto ne esca.

**Note tecniche:** lo scope è più stretto del piano originale ma completo --- "rilevamento di serie ricorrenti" e "proposta di fascicoli" sono implementate come **un solo meccanismo deterministico** basato sull'emittente di FASE 18 (una forma societaria o un'intestazione maiuscola, non una somiglianza di significato): coerente col principio già seguito in FASI 18-19, **nel dubbio, non si propone nulla**. Nuovo modulo `domain/bulk-import/` (distinto da `domain/import/`, l'import CSV di beni/amici/scadenze). `groupByIssuer` è generica sul tipo di file per portare in giro i campi modificabili del riepilogo. Scope deliberatamente più stretto del caricamento singolo: niente bene collegato né scadenza nel riepilogo di massa. Un fascicolo nuovo si crea una volta per gruppo, non per file.

Verificato: 15 unit test (soprattutto i casi in cui il raggruppamento deve tacere), due e2e con browser vero (import con emittente comune, totali di spesa), suite Archivio/Beni/Categorie/Scadenze/Fascicoli (39 e2e) rieseguita.

---

## 2026-09-20 (2)

### FASE 20 --- Fascicoli: le vicende che durano nel tempo

**Cosa fa:** un nuovo oggetto in Archivio --- il **Fascicolo** --- per le vicende che attraversano più categorie (un problema di salute, l'acquisto di una casa): una categoria è un cassetto, un fascicolo mette insieme documenti che vivono in cassetti diversi.

Si crea da **Fascicoli** in nav: titolo e descrizione, nasce sempre aperto. I documenti si collegano dal loro form con il nuovo campo **"Fascicolo"** (indipendente da categoria e bene). La scheda mostra:

- la **cronologia**, ordinata per la data letta *dentro* il documento (FASE 18) quando c'è, non per data di caricamento;
- il **totale**, la somma degli importi riconosciuti nei documenti collegati --- "—" e non "€0,00" quando nessuno ne ha uno.

Si chiude e riapre con un clic; eliminarlo scollega i documenti senza eliminarli.

**Note tecniche:** nessuna IA in questa fase --- creazione e collegamento sono manuali. `dossier_id` su `documents`, indipendente da `category_id`/`related_asset_id`, `ON DELETE SET NULL`. Cronologia e totale sono funzioni pure calcolate al volo sul testo già decifrato, non salvate: nessuna migrazione se la logica cambia. Il totale somma in **centesimi interi**, non in virgola mobile.

**Bug preesistente scoperto lungo il percorso:** aggiungere il campo "Fascicolo" al form ha fatto ripartire test e2e già esistenti perché `handleFileChange` (FASE 19b) azzerava tutti i metadati a ogni scelta di file, comprese categoria/bene/tag/note impostati un istante prima --- violava la regola stessa della FASE 19b ("non si tocca ciò che è già compilato"). Corretto: si azzera solo il segno "suggerito da Hinthial", mai i valori.

Verificato: 9 unit test su cronologia e totale (incluso il caso 0,10+0,20 in virgola mobile), un e2e end-to-end completo, suite Archivio/Beni/Categorie/Scadenze (oltre 35 e2e) rieseguita.

---

## 2026-09-20

### Miniature: aprire la scheda di un documento non lo riscarica più per intero

**Cosa fa:** ogni PDF e immagine caricati in Archivio ottengono ora una **miniatura** cifrata, salvata accanto al documento. Da questo momento **aprire la scheda di un contenuto non riscarica più il file intero**, solo la miniatura.

**Perché conta:** in un'architettura zero-knowledge non c'è cache locale --- ogni apertura della scheda riscaricava e decifrava il file intero. Misurato con un browser reale: su un'immagine da 1,4 MB la scheda ora scarica 166 KB invece del file intero (~8,7 volte meno); il guadagno cresce con la dimensione del documento, dato che la miniatura ha dimensione tendenzialmente fissa (900px al lato massimo).

**Cosa vede l'utente:** quasi niente --- la scheda si apre più in fretta, con la didascalia "Anteprima. Usa «Scarica» per l'originale" (per un PDF, "…pagina per pagina", perché la miniatura non porta il numero di pagine).

**Note tecniche:** la miniatura vive come oggetto separato nello stesso bucket cifrato (`<id>-thumb.json`), non come colonna in `documents` --- l'elenco Archivio legge quella tabella a ogni caricamento pagina, e appesantirla avrebbe reso caro l'unico percorso oggi gratis. Resta solo un booleano (`has_thumbnail`). Cifrata direttamente sotto la Master Key (come note/tag), non con una chiave documento dedicata: è dato derivato. Generata al momento del caricamento, quando il file è già in chiaro in memoria per l'estrazione testo. JPEG, 900px, qualità 0,72: pensata per riconoscere il documento, non per leggerlo.

**Bug trovato dal test:** il primo backfill falliva in silenzio con "resource already exists" quando un caricamento precedente aveva lasciato una miniatura orfana --- l'upload riusava la funzione del contenuto principale (`upsert: false` deliberato, per non sovrascrivere in silenzio). Per la miniatura quella regola è sbagliata, essendo dato idempotente: nuova `uploadEncryptedThumbnail` (`upsert: true`) dedicata.

**Backfill senza banner dedicato:** si aggancia agli stessi due percorsi già esistenti per il testo estratto ("Leggili ora"/"Rileggi"), generando la miniatura nello stesso momento in cui i byte sono già in chiaro --- nessuna migrazione forzata su tutto l'archivio.

Verificato: 11 unit test su `lib/thumbnail.ts`, 3 e2e che distinguono i due percorsi dalla didascalia mostrata, suite Archivio (23 e2e) rieseguita, un test preesistente aggiornato per la nuova didascalia.

---

## 2026-09-18 (9)

### Ritocchi all'Archivio: il link senza sottolineatura, e la scheda riordinata

**(1) Il nome di un documento non si sottolinea più al passaggio del mouse** (rumore in un elenco lungo) --- passa al **blu Hinthial**, il colore che segnala in tutta l'app ciò su cui si può agire.

*Nota tecnica:* nel tema scuro si usa un blu più chiaro --- il token `--brand` identico nei due temi renderebbe il nome meno leggibile su fondo quasi nero.

**(2) Nel dettaglio di un documento, "Cosa ne ho ricavato" si è spostato sotto "Scheda"**, nella colonna di destra: sono la stessa cosa vista da due parti, ciò che il documento **è** e ciò che il documento **dice**. *"Cosa ho letto"* e *"Hinthial propone"* restano in fondo a tutta larghezza (l'unica che chiede una risposta, e una domanda stretta in colonna è una domanda che nessuno vede).

Affiancando i due riquadri sono emerse due ripetizioni: ora *"Cosa ne ho ricavato"* mostra solo ciò che **non si legge già altrove nella stessa schermata** --- niente scadenza se già impostata nella scheda, niente titolo (non applicabile da quella pagina, vive dov'è utile, al caricamento).

---

## 2026-09-18 (8)

### FASE 19b --- il documento si legge da solo appena lo scegli

**Cosa fa:** carichi un file e, **prima di salvare**, il form è già compilato. Scegli `scan_0012.pdf` e trovi un riquadro *"✓ Ho letto il documento"* con emittente, data e importo (ognuno con la riga da cui viene), **Categoria** e **Bene collegato** suggeriti, **Scadenza** trovata nel testo, e un titolo pronto con un clic. Premi Salva e basta.

**Perché serviva:** la FASE 19 aveva costruito il meccanismo delle proposte nel posto meno frequentato dell'app --- una scheda che si apre solo andandola a cercare. Chi carica venti documenti senza aprirne nessuno non avrebbe mai visto una proposta; il momento in cui hai la testa sul documento è proprio quello in cui lo carichi.

**La lettura parte quando scegli il file, non quando premi Salva:** avviene mentre compili tag e note, quindi quando arrivi in fondo ha già finito.

**Il bene collegato è l'aggancio più forte che ci sia:** targa/IBAN/numero di polizza che compaiono nel documento non sono una somiglianza, sono una certezza, e portano con sé anche la categoria giusta.

**Correggi una data e Hinthial ritrova la frase da cui viene** --- utile soprattutto quando ne trova cinque (emissione, decorrenza, scadenza, stampa) e sceglie quella sbagliata. Il confronto è tra **date**, non tra stringhe, altrimenti "14 marzo 2026" non troverebbe mai `2026-03-14`. Quando non trova nulla lo dice: *"Questa data nel documento non l'ho trovata. La salvo lo stesso."*

**Note tecniche --- due regole imparate strada facendo:** in creazione si precompila, sulla scheda si chiede (non c'è ancora nulla dell'utente da sovrascrivere, e rivedere un form riga per riga *è* il consenso). Il titolo però **si propone e non si impone**: la prima versione lo precompilava, e dieci e2e sono diventati rossi perché i documenti non si chiamavano più come il loro file --- a differenza di categoria/bene/scadenza (campi vuoti), il nome del file c'è sempre, e sostituirlo d'ufficio viola la regola della FASE 19 ("non si tocca ciò che è già compilato"). Il campo Scadenza compare ora anche in creazione. Il segno *"✨ suggerito da Hinthial"* sparisce appena tocchi il campo.

Verificato: 21 unit test nuovi (riconoscimento beni, titolo, ritrovamento data nel testo), 3 e2e sul percorso completo, 24 e2e dell'Archivio rieseguiti in blocco.

---

## 2026-09-18 (7)

### FASE 19 --- Hinthial propone, tu decidi

**Cosa fa:** sulla scheda di un contenuto compare un riquadro **"Hinthial propone"** con quello che ha capito, con tre risposte per proposta: **Accetta**, **Modifica**, **No grazie**. Accetti una scadenza proposta e compare in **Scadenze** con tutte le altre.

**Questa fase non porta funzioni: porta il permesso di scrivere.** Fino alla 18 Hinthial mostrava soltanto; qui nasce il meccanismo di accetta/modifica/rifiuta che rende sicuro scrivere per conto dell'utente.

**"Modifica" è il caso più frequente, non l'opzione di mezzo:** una proposta è spesso giusta per metà, e senza una terza via l'utente rifiuterebbe e rifarebbe tutto a mano, smettendo di leggere le proposte.

**Quello che rifiuti non ti viene richiesto più**, ma vale per quel valore, non per quel tipo: rifiutare "3 giugno 2027" non esclude che una rilettura ne proponga un'altra data.

**Tutto è annullabile e tutto lascia traccia** in *Impostazioni → Attività*.

**Note tecniche:** il vincolo *il server può proporre, solo il client può scrivere* è rispettato in modo strutturale: `buildProposals` è una funzione pura che gira nel browser sul testo già decifrato. Il valore **rifiutato** è cifrato con la Master Key --- a differenza di un valore accettato (che finisce comunque in chiaro in `documents.expires_at`), un rifiuto non esisterebbe altrimenti in chiaro sul server, quindi il confronto tra una proposta nuova e i rifiuti passati avviene sul client.

Tre regole su quando tacere: niente proposte su campi già compilati (svuotare il campo le fa tornare); niente proposte già rifiutate; niente proposte senza una fonte da mostrare nel documento. Proponibili oggi solo scadenza e categoria --- data documento, importo ed emittente restano visibili ma non proponibili. Il categorizzatore euristico guarda ora anche dentro il documento, ma solo con parole chiave curate (non la corrispondenza col nome categoria, che su tremila caratteri darebbe troppi falsi positivi).

Verificato: 12 unit test su `buildProposals` (soprattutto i casi in cui deve tacere), 4 e2e sulle due promesse non verificabili da unit test (accettare scrive davvero, rifiutare viene ricordato dopo un ricaricamento).

**Limite dichiarato:** l'annullamento vale finché resti sulla pagina --- un registro di undo persistente sarebbe sproporzionato rispetto al guadagno.

---

## 2026-09-18 (6)

### FASE 18 --- dal testo ai campi: "cosa ne ho ricavato"

**Cosa fa:** sulla scheda di un contenuto compare un riquadro con ciò che Hinthial ha **capito** leggendo il documento: data del documento, scadenza, importo, emittente --- ognuno con il pezzo di documento da cui viene. Una scadenza può anche essere **calcolata** (es. da "controllo tra dodici mesi" più la data del prelievo), etichettata come tale per distinguere un conto da una data letta. Non scrive niente nella scheda, lo dice esplicitamente: la scrittura automatica arriva con la FASE 19, che porta accetta/modifica/rifiuta.

**Note tecniche:** sono schemi, non ragionamento --- nessun modello, nessun download. Non si salva nulla nel database: i campi si calcolano al volo dal testo già decifrato in memoria, quindi nessuna migrazione e valgono da subito su tutto l'archivio esistente.

Le regole restrittive contano più di quelle permissive: un numero con la virgola non è un importo (serve un simbolo di valuta o un'etichetta di totale attaccata, altrimenti "Glicemia 92,50" ne sarebbe uno); una data qualunque non è una scadenza (serve una parola che la qualifichi); il punto non separa le date (altrimenti ogni "art. 2.1.3" lo sarebbe); le scadenze a intervallo si calcolano solo con una data del documento da cui contare e una parola che le apra (*controllo*, *rinnovo*); il titolo di un documento non è chi l'ha emesso (una lista di parole che aprono un titolo scarta le righe tipo "CERTIFICATO DI RESIDENZA").

Le quattro sezioni della scheda hanno ora un `aria-label` (vere *region* per lo screen reader, e i test le puntano per nome).

Verificato: 41 unit test (metà sui casi che **non** devono essere riconosciuti, dove una regex troppo larga farebbe danni), un e2e end-to-end sulla scansione (OCR → testo → schemi → interfaccia).

### La trascrizione audio/video si sposta nel blocco B

Era l'ultimo pezzo della FASE 17, spostato non per stanchezza ma perché la tecnologia locale non sa ancora farlo bene: un modello vocale in-browser pesa 40-75 MB contro i 5,6 MB dell'OCR, è spesso più lento del tempo reale su un telefono, e in italiano sbaglia abbastanza da rendere la trascrizione un danno --- a differenza dell'OCR, produce frasi *plausibili* anche quando ha capito male, e il filtro anti-spazzatura non è replicabile per l'audio. Diventa la FASE 22b, con un modello vero dietro consenso esplicito. Nel frattempo la scheda dichiara onestamente *"non so ancora ascoltare gli audio"*, e la trascrizione si scrive a mano. **La FASE 17 si chiude qui.**

---

## 2026-09-18 (5)

### FASE 17e --- la scheda di un contenuto: "cosa ho letto"

**Cosa fa:** ogni elemento dell'Archivio ha ora una pagina sua, raggiungibile dal nome nell'elenco o dai risultati della ricerca globale (prima portavano genericamente all'Archivio). Mostra l'anteprima, la scheda (categoria, bene, scadenza, tag, note) e un riquadro **"Cosa ho letto"** con il testo che Hinthial ha ricavato dal file, per intero.

**L'anteprima vale anche per i PDF:** se ne disegna la prima pagina con lo stesso pdf.js dell'OCR, con il numero totale di pagine sotto. Audio e video non si scaricano da soli (possono pesare decine di MB).

**Perché conta più di quanto sembri:** dalla FASE 17 Hinthial legge i documenti, ma l'unica traccia visibile era uno spezzone nei risultati di ricerca. Vedere esattamente cosa è stato letto è la dimostrazione della promessa *"niente esce dal tuo dispositivo"*.

**I quattro stati finalmente si distinguono** (prima, in tre casi su quattro, il testo risultava semplicemente vuoto): *mai letto* (tasto "Leggilo ora"), *letto ma senza testo trovato*, *letto con successo* (tasto "Rileggi" se l'OCR ha sbagliato), *non so ancora ascoltare gli audio*.

**Il testo estratto ora conserva l'impaginazione** (prima ogni a capo veniva schiacciato in uno spazio, illeggibile su un referto di più pagine). I documenti caricati prima restano nella vecchia forma finché non si preme "Rileggi" --- deliberatamente nessuna migrazione forzata.

**Note tecniche:** `normalizeExtractedText` compatta gli spazi dentro la riga senza schiacciare tutto, usando `hasEOL` di pdf.js. Per non rompere la ricerca su testo multi-riga, `flattenForSearch` (con test dedicati) appiattisce dove si cerca e dove si costruisce lo spezzone. Nuovo `lib/pdf.ts` unifica la preparazione di pdf.js tra estrattore e anteprima (JPEG, non PNG: una pagina scansionata è una fotografia). Nuovo `domain/extraction/reading-state.ts` (7 test), funzione pura che decide quale dei quattro stati raccontare. `formatSize`/`formatDate` estratte in `lib/format.ts`, erano due copie divergenti.

**Di proposito NON c'è**, pur essendo pronto ad accoglierlo: nessun riquadro vuoto per campi estratti/proposte/fascicolo/consenso (fasi future) --- una pagina piena di sezioni "in arrivo" sembra finita e non lo è. Il testo letto resta in sola lettura (renderlo modificabile lo confonderebbe con le Note, e una rilettura cancellerebbe la correzione).

Verificato: 10 unit test, due e2e (testo mostrato con gli a capo reali; recupero di un documento riportato a "mai letto"). Corretti di passaggio due e2e (`list-filters`, `transcription`) rimasti indietro dalla FASE 17a, rotti da allora senza che nessuno li rieseguisse.

---

## 2026-09-18 (4)

### FASE 17d --- anche i PDF che sono solo una scansione

**Cosa fa:** un PDF che è solo la fotografia di un foglio scansionato (il caso più comune nei documenti sanitari e burocratici italiani) non conteneva testo e restava muto. Ora, quando Hinthial si accorge che un PDF non ha testo, ne disegna le pagine e le legge con l'OCR, come farebbe con una foto.

**Note tecniche:** la soglia è "il testo è sotto i 40 caratteri?" e non "è vuoto?", perché un PDF scansionato porta quasi sempre qualche carattere di scarto. Otto pagine al massimo (un faldone da cento bloccherebbe l'utente per minuti, per un guadagno che il tetto di 200.000 caratteri taglierebbe comunque); 1700px di larghezza (l'intervallo dove Tesseract legge bene); il filtro anti-spazzatura vale per pagina, non per documento, così il retro bianco di un foglio non rovina le pagine leggibili.

Verificato con un e2e su un PDF con un unico JPEG e nessun livello di testo (confermato che `getTextContent()` restituisce stringa vuota) --- se la ricerca trova una parola lì dentro, l'ha letta l'OCR.

---

## 2026-09-18 (3)

### FASE 17c --- Hinthial legge dentro le foto

**Cosa fa:** fotografi uno scontrino, una ricetta, un referto stampato --- e Hinthial legge il testo nell'immagine, cercabile da quel momento per il contenuto, non solo per il nome del file. Vale anche all'indietro: le immagini già in archivio compaiono nell'avviso "Leggili ora". L'attesa è annunciata con una percentuale ("Sto leggendo l'immagine… 42%"), non subita in silenzio.

**Come per i PDF, non esce niente:** il riconoscimento avviene sul dispositivo. La prima volta Hinthial scarica una tantum il motore di lettura (~5,6 MB) **dal proprio dominio, non da una CDN esterna** --- scaricarlo da terzi rivelerebbe comunque "questo utente sta leggendo un documento ora".

**Note tecniche:** Tesseract.js (WebAssembly) dietro la stessa interfaccia `TextExtractor` di pdf.js. Un solo file di motore (variante SIMD/solo-LSTM, non tutte e sei le varianti, ~12 MB) e solo italiano, per limitare il download iniziale. Il filtro anti-spazzatura scarta ciò che sta sotto una soglia di confidenza *o* che non ha almeno tre gruppi di caratteri di lunghezza credibile (la confidenza da sola può essere altissima su due lettere) --- senza, un muro o una firma restituirebbero comunque simboli slegati che inquinerebbero la ricerca. Il motore resta acceso un minuto dopo l'ultima immagine, per non ricompilare il WebAssembly venti volte recuperando venti foto dal banner. I file del motore non sono in git: copiati da `node_modules` da `scripts/sync-ocr-assets.mjs`.

Verificato: 13 unit test (filtro anti-spazzatura in ogni caso limite), un e2e che carica un'immagine vera e cerca una parola che esiste solo dentro i pixel (unico modo di esercitare l'intero percorso: Web Worker, WebAssembly, cifratura, rilettura).

**Resta fuori, per il passo successivo:** i PDF fatti di sole scansioni (un'immagine dentro un PDF, dove pdf.js non trova testo).

---

## 2026-09-18 (2)

### FASE 17b --- il perché dei risultati, e i documenti già in archivio

**Cosa fa:** tre rifiniture alla lettura dei PDF introdotta poco fa. **(1)** Il risultato di ricerca mostra ora lo spezzone di testo attorno alla parola trovata, evidenziata (non compare se la parola è già nel nome del file). **(2)** Il pulsante di caricamento dice *"Sto leggendo il documento…"* mentre legge e *"Salvataggio…"* mentre salva, invece di "Salvataggio…" per tutta l'attesa. **(3)** I documenti caricati prima di questa fase si recuperano: un avviso in Archivio con **"Leggili ora"** li scorre uno per uno mostrando l'avanzamento.

**Note tecniche:** nuova colonna `extracted_at` distingue tre stati prima indistinguibili (mai tentata, tentata con esito, tentata a vuoto --- tipicamente una scansione in attesa dell'OCR). Il recupero è sequenziale, non parallelo (un file illeggibile viene contato e non ferma gli altri). Nuovo `lib/text-snippet.ts` (8 test): sceglie il primo termine presente, conserva la forma del testo, allinea il taglio al confine di parola solo quando è vicino.

Verificato: 8 unit test sullo spezzone, e2e esteso (spezzone solo cercando per contenuto, recupero funzionante di un documento "mai letto").

**Resta fuori, deliberatamente:** l'avviso "nessun testo leggibile" per le scansioni (l'OCR lo risolverà un passo dopo) e lo spezzone nella ricerca globale (passa da `AISource`, dove oggi viaggiano solo metadati verso Claude).

---

## 2026-09-18

### FASE 17, primo passo --- la ricerca guarda dentro i PDF

**Cosa fa:** quando carichi un PDF in Archivio, Hinthial ne legge il testo **sul tuo dispositivo** e lo salva cifrato insieme al resto. Da quel momento la ricerca trova un documento anche per una parola scritta **dentro** il file, sia in Archivio sia nella ricerca globale (Ctrl+K).

**Nessun consenso richiesto, perché non esce niente:** l'estrazione avviene nel browser, prima della cifratura. I PDF fatti di sole scansioni non contengono testo e restano per ora invisibili: li leggerà l'OCR, secondo passo di questa fase.

**Note tecniche:** nuovo modulo `domain/extraction`, un'interfaccia `TextExtractor` (oggi solo pdf.js, a cui OCR e trascrizione si aggiungeranno) sullo stesso schema a provider di `Categorizer`/`AIProvider`. Agganciata dentro `uploadDocument`, l'unico punto in cui il contenuto è già in chiaro in memoria. È best-effort e non lancia mai: un PDF malformato non impedisce di salvare il file. Nuova colonna `encrypted_extracted_text`, distinta da `encrypted_transcript` (quella scritta a mano dall'utente, questa derivata e rigenerabile) --- tenerle insieme avrebbe permesso a un'estrazione automatica di sovrascrivere testo dell'utente. Testo tagliato a 200.000 caratteri.

Due trappole trovate scrivendo: pdf.js "detacha" il buffer che riceve, quindi gli si passa una copia; il build moderno di pdf.js non funziona fuori dal browser (loader ESM di Node), quindi si usa il build `legacy` che pdf.js stesso raccomanda per Node.

Verificato: 6 unit test su un PDF vero costruito nel test, un e2e che copre pdf.js col suo worker in un browser vero (carica, cerca una parola presente e una assente).

**Nota non correlata:** `tests/unit/crypto/aes-gcm.test.ts` va in timeout su questa macchina --- verificato con `git stash` che fallisce identico anche sul codice pulito, quindi non è una regressione di questa fase (cifra 4 MB in jsdom con un limite di 20s, macchina più lenta di prima). Da rivedere a parte.

---

## 2026-09-17 (13)

### La voce AI ha la faccia di HINTHIA al posto delle due stelline

**Cosa fa:** nel menu (e in Impostazioni > Intelligenza artificiale) l'icona della voce AI non è più il solito paio di stelline, ma la faccia sorridente di HINTHIA disegnata a tratto come le altre icone di sistema.

**Note tecniche:** un glifo 24x24 `currentColor`, non un avatar a colori (a 19px una PNG non si leggerebbe e ignorerebbe gli stati attivo/hover). Occhi più curvi del previsto per compensazione ottica: a 19px un arco poco profondo si appiattisce in un trattino, e il sorriso diventa assonnato. Escluso il germoglio (si riduce a una macchiolina a quella misura) e due varianti scartate dopo averle renderizzate (asta diagonale che leggeva come Marte ♂; semicerchi pieni). Verificato nell'app reale, stato normale e attivo.

---

## 2026-09-17 (12)

### Le tabelle si adattano allo schermo nascondendo le colonne secondarie

**Cosa fa:** con lo schermo stretto, le tabelle di Archivio, Beni, Scadenze, Amici e Capsule non sforano più verso destra: le colonne meno importanti si nascondono da sole finché la tabella entra nello spazio disponibile, e ricompaiono appena c'è di nuovo posto. Il menu azioni e la colonna identificativa (Nome/Titolo) non spariscono mai --- richiesta esplicita dell'utente, è il punto da cui si fa tutto.

**Note tecniche:** container queries (`@container` + `hidden @xl:table-cell`), non breakpoint di viewport --- tengono conto dello spazio vero del riquadro, quindi anche della barra laterale aperta o chiusa. Ordine di comparsa deciso per valore informativo, uno per tabella. Scelto di non misurare le larghezze in JavaScript: soglie fisse per contenitore danno lo stesso risultato senza un ciclo misura-ridisegna a ogni resize.

Verificato: overflow reale a 0px a 915/1100/1500px (con menu azioni sempre presente), suite e2e delle viste a tabella (ordinamento, impaginazione, filtri) invariata.

---

## 2026-09-17 (11)

### Rimossa la sezione "Da tenere d'occhio" dalla Dashboard

**Cosa fa:** la Dashboard non mostra più "Da tenere d'occhio" in fondo. Restano i contatori e i tre riquadri (Prossime scadenze, Aggiunti di recente, Elementi da completare); i suggerimenti proattivi restano in Assistente AI, dove si chiedono esplicitamente.

**Note tecniche:** discusso con l'utente, misurando la sovrapposizione reale --- due delle tre righe ripetevano dati già mostrati sopra, il resto erano metriche di completezza che misurano l'ordine, non un rischio: costruita su regole deterministiche che contano sempre qualcosa, la sezione aveva sempre qualcosa da dire, e così smetteva di significare qualcosa. Eliminati `WatchlistWidget.tsx` (non più usato) e `VaultHealthWidget.tsx` (era già codice morto, non renderizzato da nessuna parte pur avendo ancora un test che lo copriva).

**Ipotesi per il futuro, non implementata:** una sezione "Avvisi" generata dall'IA reale --- utile perché potrebbe restare vuota quando non c'è nulla da dire, ma richiederebbe un consenso proprio e una cadenza controllata.

---

## 2026-09-17 (10)

### HINTHIA compare nell'intestazione della pagina AI

**Cosa fa:** l'avatar di HINTHIA affianca ora il titolo della pagina "Assistente AI" --- primo punto dell'interfaccia in cui il personaggio si vede davvero.

**Note tecniche:** copia ridotta a 128px (8 KB), non l'originale da 1,3 MB. `alt` vuoto di proposito (il titolo accanto già dice cos'è la pagina). Resta aperta la scelta di prodotto se "Hinthia" debba sostituire "Assistente AI" nel titolo.

---

## 2026-09-17 (9)

### "Novità" aggiornata dal 15 al 17 settembre

**Cosa fa:** la pagina "Novità" era ferma al 13 settembre (segnalato dall'utente) --- aggiunte 10 voci per ciò che vale la pena raccontare da allora: sblocco biometrico e pairing via QR, capsule condivise davvero apribili, avvisi email/popup, Eredità digitale, riorganizzazione di Impostazioni, novità di Amici.

**Note tecniche:** nuova migrazione di backfill, stesso criterio di curatela già usato (niente bug fix, niente restyling puro), esclusa deliberatamente la voce sul "guardiano non collegato" (sostituita il giorno dopo dal modello Amici v2, mai annunciata).

---

## 2026-09-17 (8)

### Amici v2: PERSONA vs AMICO, e il Guardiano richiede consenso

**Cosa fa:** ripensato da zero il modello di Amici. Ogni contatto nasce **PERSONA** --- privato, un solo verso, nessuna notifica, può comunque ricevere capsule. Se l'indirizzo corrisponde a un account Hinthial esistente, compare **"Richiedi amicizia"**: email e popup al destinatario, che accetta o rifiuta. Se accetta, **entrambi** compaiono come **AMICO** nella rispettiva lista. Solo un AMICO può ricevere una richiesta di **diventare guardiano**, anch'essa da accettare esplicitamente (non più un interruttore che il proprietario azionava da solo su un amico ignaro). Chi accetta vede quella persona come "protetto" nella nuova pagina **Protetti**, da cui può dimettersi senza consenso del proprietario; il proprietario può invece rimuovere un guardiano direttamente --- serve consenso solo per assumere il ruolo, non per lasciarlo o toglierlo.

**Conseguenza per chi ha già usato la funzione:** ogni amico esistente diventa una PERSONA. Chi aveva già configurato Eredità digitale si ritrova con zero guardiani confermati finché ciascuno non accetta la nuova richiesta --- scelta esplicita dell'utente, sapendo che comporta questo.

**Note tecniche:** due nuove tabelle, `friend_requests` e `guardian_role_requests`, con RLS a due identità e transizioni di stato solo tramite funzioni `security definer` (mai una policy di update diretta: altrimenti il mittente potrebbe scriversi da solo "accepted"). `friends.is_friend` diventa true solo dentro `accept_friend_request`, che aggiorna in un colpo le righe di entrambe le parti; se il destinatario non aveva ancora una riga per il mittente, il client la crea usando nome/email presi dalla richiesta (l'unico modo per conoscerli, non essendo mai stati cifrati per lui). La policy di insert su `guardian_role_requests` verifica `is_friend = true` nel database, non solo lato client. Popup in Dashboard con Accetta/Rifiuta diretti (non un semplice "ho capito", qui serve una decisione).

Verificato: nuovo test di integrazione end-to-end contro il database reale (`friend-and-guardian-requests.integration.test.ts`, 11 casi), più un giro reale con due sessioni browser. Riscritti i test che si appoggiavano al vecchio flusso a interruttore singolo.

---

## 2026-09-17 (7)

### Amici: eliminato lo stato "In attesa"

**Cosa fa:** ogni nuovo amico nasce ora direttamente "Attivo". Lo stato "In attesa" non serviva a nulla di voluto --- nascondeva l'amico dal selettore dei destinatari finché non lo si segnava a mano come attivo, senza alcun indizio del perché. Restano solo "Attivo" e "Revocato".

**Note tecniche:** `FriendStatus` passa da 3 a 2 valori; migrazione promuove a "active" ogni riga ancora "pending" e stringe il check constraint. Rimossi da `FriendsPanel.tsx` la voce "Segna come attivo" e il filtro "In attesa".

Verificato: test aggiornati (`friends.spec.ts`, `capsules.spec.ts`, `list-filters.spec.ts`, `dashboard-counters.test.tsx`), suite completa passante.

---

## 2026-09-17 (6)

### Amici: badge "Su Hinthial" spostato sull'avatar

**Cosa fa:** "✓ Su Hinthial" non è più un badge testuale --- compare invece un tondo blu con una "H" bianca sull'avatar dell'amico. Con stato, Guardiano e "Su Hinthial" tutti in riga, su smartphone sforavano lo schermo.

**Note tecniche:** `Avatar` accetta una prop `linked` che aggiunge il badge in overlay, scalato con la taglia. Resta accessibile (`role="img"` + `aria-label`/`title`) senza il testo visibile. Aggiornati 4 e2e per cercare il badge via `getByTitle`.

---

## 2026-09-17 (5)

### Menu di Impostazioni: intestazioni di gruppo più grandi, blocchi separati su smartphone

**Cosa fa:** i nomi delle aree in Impostazioni sono più grandi, sia da desktop sia su smartphone. Su smartphone ogni area ha ora il proprio riquadro separato, con il nome sopra e fuori, non più come prima riga al suo interno.

**Note tecniche:** solo `SettingsTabs.tsx` toccato --- intestazioni da `text-xs` a `text-sm`; l'elenco mobile rende ogni gruppo come coppia intestazione + `<ul>` proprio invece di un unico elenco continuo diviso da `divide-y`. Verificato visivamente a 1600px e 390px.

---

## 2026-09-17 (4)

### Eredità digitale usa tutta la larghezza disponibile in Impostazioni

**Cosa fa:** la scheda "Eredità digitale" usa ora tutto lo spazio disponibile, come "Aspetto". I valori personalizzati si dispongono su più colonne sugli schermi larghi; su smartphone restano a colonna singola.

**Note tecniche:** rimosso `max-w-2xl` dal contenitore esterno, rimesso solo sui paragrafi discorsivi. I sei campi numerici più il quorum sono ora in griglia (`sm:grid-cols-2 lg:grid-cols-3`).

---

## 2026-09-17 (3)

### Impostazioni riorganizzate in macro-aree

**Cosa fa:** le 11 voci di Impostazioni, prima tutte allo stesso livello, sono ora raggruppate in **Sicurezza** (Sicurezza, Eredità digitale, Attività), **Privacy e dati** (Privacy, Intelligenza artificiale, Categorie, Importa/Esporta), **Personalizzazione** (Aspetto, Onboarding) --- con "Informazioni utente" in cima e "Zona pericolosa" in fondo, fuori da ogni gruppo. Stesso comportamento di sempre, solo più facile da scorrere.

**Note tecniche:** discusso a fondo con l'utente, verificando voce per voce se ogni funzione fosse al posto giusto --- "Intelligenza artificiale" e "Categorie" passate a "Privacy e dati", "Onboarding" sotto "Personalizzazione". Solo `SettingsTabs.tsx` toccato: nessuna modifica al modello dati né ai test esistenti.

---

## 2026-09-17 (2)

### FASE 12, quarto e ultimo passo --- verifica formale, attesa finale, apertura capsule

**Cosa fa:** completate le ultime tre fasi della roadmap. Dopo la conferma dei guardiani, l'account entra in una verifica formale, poi in un'attesa finale (durate configurabili), con un'ultima email al proprietario all'inizio dell'attesa finale --- l'ultimo momento in cui un accesso annulla tutto. Se anche l'attesa finale scade senza risposta, **le capsule già condivise dal proprietario diventano leggibili ai destinatari da quel momento**, indipendentemente dalla data di apertura originale, con un'email di avviso a ciascuno. In Impostazioni > Eredità digitale compare un riquadro con lo stato del proprio processo e i conteggi di quanti guardiani hanno risposto (mai i nomi, cifrati).

**Note tecniche:** nuova colonna `digital_legacy_triggered_at`, deliberatamente separata da `digital_legacy_state` (che può tornare "normal" con un accesso successivo) --- una volta impostata non viene mai azzerata: l'accesso già concesso ai destinatari non si può ritirare. Le policy RLS sui contenuti condivisi concedono la lettura in OR tra `open_at` della capsula già raggiunta oppure `digital_legacy_triggered_at` non nullo --- una capsula mai condivisa non è mai coinvolta. `runDigitalLegacyCheck` accetta un orologio iniettabile solo per i test, dato che le fasi lunghe non si possono simulare aspettando né retrodatando `state_entered_at` (finirebbe prima di `last_sign_in_at`, scatenando il reset).

Verificato con un test di integrazione end-to-end esteso contro il database reale: una capsula con `open_at` nel futuro non è leggibile prima dell'attivazione, lo diventa subito dopo, e resta leggibile anche dopo che il proprietario torna ad accedere.

**Cosa resta fuori, deliberatamente:** la revisione legale/sicurezza richiesta dalla roadmap prima di toccare dati reali in produzione; una vista per il guardiano che elenchi "di chi sono guardiano" prima di una richiesta attiva.

---

## 2026-09-17

### FASE 12, terzo passo --- coinvolgimento dei guardiani

**Cosa fa:** quando il periodo di grazia scade senza risposta, ogni guardiano collegato riceve un'email --- *"[Nome] ti ha indicato come guardiano, hai sue notizie?"* --- con un link dove rispondere (richiede login, mai un click anonimo). Una sola risposta "sta bene" annulla tutto. Se abbastanza guardiani confermano di non riuscire più a raggiungerlo (quorum scelto in Impostazioni: tutti/maggioranza/uno solo), il proprietario riceve un ultimo avviso e l'account entra in un'attesa che una fase futura dovrà raccogliere.

**Note tecniche:** nuova tabella `guardian_verification_requests` con RLS a due identità. Registrare la risposta nel registro Attività *del proprietario* (non del guardiano che risponde) richiede una funzione SECURITY DEFINER (`respond_to_guardian_verification_request`), stesso schema di `log_failed_login_attempt`. La logica del quorum e l'estensione della macchina a stati pura restano prive di accesso a database, testate con 12 nuovi casi.

Verificato con un test di integrazione end-to-end contro il database reale, due account veri: richiesta creata, lettura sotto RLS, risposta via RPC, quorum raggiunto, evento registrato sotto l'account giusto. La vera attesa per inattività non è simulabile in test (un accesso reale ha sempre `last_sign_in_at` più recente di qualunque retrodatazione) --- risolto avviando il test già nello stato "awaiting_guardians".

---

## 2026-09-16 (7)

### Amici: un guardiano senza account collegato avvisa che non potrà essere raggiunto

**Cosa fa:** segnare come guardiano un contatto senza account Hinthial collegato è ancora permesso, ma un popup lo conferma subito e il badge "🛡️ Guardiano" diventa arancione finché quel contatto non si collega.

**Note tecniche:** un guardiano non collegato è oggi irraggiungibile dal server per definizione (la sua email è cifrata con la master key del proprietario) --- la fase futura di coinvolgimento potrà contare solo i guardiani con `linked_user_id` non nullo. Nessuna modifica al modello dati, solo interfaccia.

---

## 2026-09-16 (6)

### FASE 12, secondo passo --- rilevamento inattività e promemoria, opt-in esplicito

**Cosa fa:** in Impostazioni > Eredità digitale compare un interruttore "Attiva Eredità digitale", spento di default --- **nessuna email parte finché non lo si accende esplicitamente**, qualunque preset sia già configurato. Da acceso, un controllo quotidiano osserva l'ultimo accesso di ciascun account: superata la soglia di inattività arriva un'email, ripetuta secondo la cadenza scelta; senza risposta, dopo l'ultimo promemoria comincia il periodo di grazia (email più esplicita: un solo accesso annulla tutto). **Ancora nessun coinvolgimento dei guardiani né apertura di capsule** --- il periodo di grazia scaduto lascia l'account in attesa di una fase futura.

**Note tecniche:** "attività" oggi significa solo "accesso" (`auth.users.last_sign_in_at`, gestito da Supabase). Il cuore della logica (`computeDigitalLegacyTransition`) è una funzione pura, interamente testabile con date finte (19 nuovi test, incluso il reset su un accesso avvenuto dopo l'inizio dello stato corrente). L'orchestrazione (`runDigitalLegacyCheck`) pagina tutti gli utenti via l'API admin, applica l'azione, manda l'email (best-effort) e registra l'evento in Attività --- eseguita una volta al giorno da un cron Vercel protetto da `CRON_SECRET` (senza quella variabile, la route rifiuta ogni richiesta con 401 invece di girare senza protezione). Cinque nuove colonne su `profiles` per lo stato della macchina a stati.

**Da fare, solo l'utente può farlo:** impostare `CRON_SECRET` sia in `.env.local` sia su Vercel --- senza, il cron non farà mai nulla.

---

## 2026-09-16 (5)

### FASE 12, primo passo --- Impostazioni > Eredità digitale: solo i parametri, nessuna automazione ancora

**Cosa fa:** una nuova scheda "Eredità digitale" dove scegliere la strategia che deciderà --- in una fase futura, non ancora costruita --- quando le capsule arrivano davvero a chi le doveva ricevere. Tre preset rapidi (Prudente/Normale/Rilassato) più "Personalizza i valori" (soglia di inattività, promemoria, periodo di grazia, quorum guardiani, verifica formale, attesa finale), con un riepilogo in linguaggio semplice che si aggiorna in tempo reale. **Importante:** solo configurazione --- nessun rilevamento, promemoria o apertura di capsule è ancora costruito.

**Note tecniche:** discusso a fondo con l'utente prima di scrivere codice (nome, terminologia guardiano/protetto, flusso a 7 fasi, valori dei preset). Otto nuove colonne su `profiles`, con vincoli `check` contro configurazioni assurde, applicati anche client-side (`clampDigitalLegacyField`). Diagnosticati e corretti durante la verifica due difetti pre-esistenti scoperti per caso, non causati da questa modifica: un placeholder di ricerca mai aggiornato dopo la rinomina "Contatti fiduciari" → "Amici"; un'ambiguità tra una riga di tabella e un popup di conferma omonimo.

---

## 2026-09-16 (4)

### Rimossa la checklist "Onboarding" dal corpo della pagina Dashboard

**Cosa fa:** la Dashboard non mostra più la checklist "Onboarding" tra i propri contenuti --- resta consultabile dall'indicatore persistente in barra laterale, che apre la stessa lista in un pannello.

**Note tecniche:** rimossa la card da `DashboardWidgets` e la mini-checklist da `DashboardPanel` (sostituita da un link "vai all'archivio"). Nessuna modifica alla logica di calcolo dei passi né al gadget in barra laterale, unico punto rimasto da cui la checklist è raggiungibile.

---

## 2026-09-16 (3)

### Bug corretto: il tasto "+" tondo su smartphone poteva apparire spostato oltre il bordo destro dello schermo, con scorrimento orizzontale indesiderato

**Cosa fa:** su smartphone, il tasto "+" tondo in sovraimpressione poteva finire fuori dal bordo destro visibile --- un effetto mai voluto.

**Note tecniche:** `<html>` ha già `overflow-x: hidden`, ma non basta su alcuni browser mobile: un elemento `position: fixed` può calcolare il proprio `right` rispetto alla larghezza reale del documento se un altro contenuto la eccede anche di poco. Serve tagliare anche su `<body>`, ma non con un secondo `overflow-x: hidden` (due `hidden` avevano già causato, in precedenza, un accoppiamento indesiderato che rompeva `position: sticky` di Sidebar/TopNav/MobileNavBar). Usato invece `overflow: clip` su `<body>`, che non crea un contenitore scrollabile e quindi non soffre dello stesso accoppiamento.

Verificato: `position: sticky` continua a funzionare (suite `sticky-nav.spec.ts` e affini).

---

## 2026-09-16 (2)

### Bug corretto: chi condivide una capsula la ritrovava anche nel proprio elenco "Condivise con me"

**Cosa fa:** dopo aver condiviso una capsula, il mittente non la vedeva più (per errore) tra le proprie "Condivise con me".

**Note tecniche:** `listCapsulesSharedWithMe` leggeva `capsule_shares` senza filtro esplicito, affidandosi solo a RLS --- che ha due policy SELECT separate (proprietario/destinatario) combinate in OR da Postgres, quindi tornava le righe in entrambi i ruoli. Corretto aggiungendo `.eq("recipient_user_id", user.id)` alla query, senza toccare la RLS. Diagnosticato da una segnalazione su un account reale.

### Bug corretto: "Decryption failed" nella pagina Capsule per chi ha ricevuto una capsula ma non ne possiede ancora nessuna propria

**Cosa fa:** un account senza capsule proprie, ma con una capsula ricevuta, vedeva un errore di decifratura invece della propria lista vuota.

**Note tecniche:** stessa classe di difetto della voce precedente, in `listCapsules`: nessun filtro su `owner_id`, solo RLS (che ammette anche le righe condivise CON l'utente, il cui `encrypted_payload` è cifrato con la Master Key del *proprietario*). Corretto aggiungendo `.eq("owner_id", user.id)`.

---

## 2026-09-16

### Avvisi di condivisione capsule (email + popup in Dashboard), messaggi di conferma come popup, avatar al posto del ☰ su smartphone

**Cosa fa:** quattro miglioramenti richiesti dall'utente. (1) Il tasto menu su smartphone è ora l'avatar dell'account. (2) Chi riceve una capsula condivisa riceve anche un'email di avviso. (3) I messaggi di conferma appaiono ora come popup in sovraimpressione che sparisce da solo, invece di spostare il contenuto sotto di sé. (4) Chi riceve una capsula trova, la prima volta che apre la Dashboard dopo la condivisione, un popup che non ricompare più per quella capsula una volta chiuso.

**Note tecniche:** l'email (`notifyCapsuleShared`) è una Server Action best-effort chiamata da `shareCapsule`/`syncCapsuleSharesForLinkedFriend` --- un fallimento non blocca la condivisione. L'indirizzo del destinatario è risolto server-side con l'API admin a partire dal solo id, mai conosciuto dal chiamante. Il popup "per sempre" si appoggia a `capsule_shares.dismissed_at` con una policy RLS dedicata. I popup di conferma condividono un nuovo `ToastProvider`, che sostituisce interamente il vecchio `SuccessMessage` in cinque pannelli. Durante la verifica, scoperto e corretto un difetto pre-esistente della FASE 13: il tasto "Sblocca con un dispositivo fidato" rende ambiguo qualunque test che cerchi "Sblocca" senza `exact: true`.

---

## 2026-09-15

### FASE 13, ultimo passo --- elenco e revoca di tutti i dispositivi fidati, da qualunque dispositivo

**Cosa fa:** in Impostazioni > Sicurezza trovi ora l'elenco di *tutti* i dispositivi resi fidati --- nome, registrazione, ultimo accesso --- gestibile da qualunque dispositivo. Revocarne uno diverso da quello in uso gli fa perdere lo sblocco biometrico al prossimo tentativo. Registrazione e revoca compaiono ora nel registro Attività.

**Note tecniche:** ultimo dei quattro passi di FASE 13. Nessuna nuova tabella: riuso di `forgetTrustedDevice` (identica sia rimuovendo se stessi sia un altro dispositivo, con la sola differenza che rimuovere se stessi svuota anche la copia locale del Master Key). Un dispositivo diverso si autoguarisce al suo prossimo tentativo di sblocco (`findActiveTrustedDevice` non lo trova più tra i non revocati).

### FASE 13, secondo passo --- sblocca un dispositivo nuovo facendolo approvare da uno già fidato, via QR code

**Cosa fa:** su un dispositivo nuovo, nella schermata di sblocco puoi scegliere "Sblocca con un dispositivo fidato": compare un QR code. Inquadralo con un dispositivo già fidato e conferma lì con la master password una volta --- il primo dispositivo si sblocca da solo in pochi secondi, senza che tu l'abbia mai digitata lì.

**Note tecniche:** riusa lo scambio ECDH effimero-effimero già scritto per FASE C1: nessuna delle due parti ha una chiave permanente, entrambe derivano lo stesso segreto condiviso (proprietà simmetrica dell'ECDH) con cui si cifra il Master Key. Nuova tabella `device_pairing_requests` fa da tramite --- il server vede solo due chiavi pubbliche effimere e un blob già cifrato, mai il Master Key; righe a vita breve (5 minuti), cancellate non appena consumate. Il QR incorpora solo un URL (`/pair/<id>`), niente lettore di QR scritto apposta.

Verificato con un e2e a due browser context separati: un dispositivo genera la richiesta e resta in attesa (polling), l'altro la approva, il primo si sblocca da solo.

### FASE 13, primo passo --- sblocca il vault con l'impronta o Face ID, non solo con la master password

**Cosa fa:** in Impostazioni > Sicurezza puoi "rendere fidato" il dispositivo in uso (richiede la master password una volta): da quel momento puoi sbloccare con l'impronta o Face ID. "Dimentica questo dispositivo" annulla la fiducia in un clic.

**Note tecniche:** primo dei quattro passi di FASE 13. Usa l'estensione PRF di WebAuthn (`lib/crypto/device-lock.ts`): a differenza del normale uso per il login, PRF restituisce un valore pseudo-random legato alla credenziale, mai il segreto sottostante --- il suo output alimenta HKDF, come per password/recovery key. La chiave derivata cifra una copia del Master Key che vive solo in `localStorage`; il server sa solo che il dispositivo esiste, mai il segreto che lo sblocca. Sciolta consapevolmente la decisione architetturale della spec (Master Key *non-extractable*): `unlockMasterKeyWithPassword` accetta un flag `extractable`, usato solo in questo punto.

Verificato con un vero autenticatore WebAuthn (l'autenticatore virtuale di Chrome DevTools Protocol, `hasPrf: true`, non mockato).

### Bug corretto: il tasto ☰ poteva restare senza effetto subito dopo il login

**Cosa fa:** in alcuni casi, toccare ☰ appena arrivati sulla Dashboard non apriva il menu --- bastava cambiare sezione e tornare indietro perché funzionasse di nuovo. Ora si apre subito, anche al primissimo tocco.

**Note tecniche:** diagnosticato isolando una sequenza riproducibile (chiudere il popup "Crea la tua master key" e toccare subito ☰) e tracciando i render di `useMountedTransition`. Il momento critico coincide sempre con il montaggio di altri componenti dentro il cassetto appena apparso --- corretto con un effetto separato che riafferma lo stato "montato" se il primo tentativo non ha avuto seguito.

### Bug corretto: il menu di navigazione (☰ su smartphone, barra laterale sopra) scorreva via con la pagina

**Cosa fa:** su una pagina più alta di una schermata, il menu ☰ e la barra laterale ora restano sempre visibili scorrendo, invece di scorrere via col resto del contenuto.

**Note tecniche:** due cause. (1) `<aside>` non aveva un'altezza propria né `position: sticky` --- per flexbox seguiva l'altezza di `<main>`, finendo alto migliaia di pixel su pagine lunghe. Aggiunto `md:sticky md:top-0 md:h-screen` a Sidebar, `sticky top-0` a TopNav/MobileNavBar. (2) `overflow-x: hidden` era impostato sia su `<html>` che su `<body>`: la regola CSS che accoppia gli assi trasformava entrambi in contenitori di scroll verticale ambigui, e un elemento sticky si ancorava a quello sbagliato. Rimosso da `<body>`, lasciato solo su `<html>`.

Verificato con `sticky-nav.spec.ts`. Nota separata: emerso un secondo bug distinto, non ancora corretto --- il cassetto mobile non si apre se aperto dalla pagina Impostazioni specificamente.

### FASE C1 --- una capsula chiusa e condivisa diventa davvero apribile da chi la riceve

**Cosa fa:** se un amico "✓ Su Hinthial" è tra i destinatari di una capsula, chiudendola e condividendola la ritrova in "Condivise con me", con lo stesso countdown. Dalla data di apertura compare "🔓 Apri", che mostra il contenuto decifrato sul suo dispositivo con la sua Master Key, mai con la tua.

**Note tecniche:** ogni account guadagna una coppia di chiavi ECDH (P-256), pubblica in chiaro e privata cifrata dalla Master Key del proprietario. Le capsule cifrano il payload direttamente con la Master Key del proprietario (non con una Document Key indipendente): condividerlo richiede quindi una seconda cifratura parallela --- alla chiusura, una coppia ECDH effimera deriva una chiave AES-256-GCM condivisa con la chiave pubblica del destinatario, che cifra una copia del contenuto in una nuova tabella (`capsule_share_keys`). Il destinatario rideriva la stessa chiave con la propria privata (proprietà simmetrica di ECDH). La data di apertura è verificata dal database stesso via RLS, non solo dal client. Non è ancora il Dead Man's Switch --- resta apertura manuale a data fissa.

Verificato con un e2e dedicato (due account reali) e un unit test sullo scambio di chiavi che prova che il segreto condiviso è lo stesso su entrambi i lati e che un terzo non può derivarlo.

## 2026-09-14

### Bug corretto: un amico collegato a un account non si scollegava più cambiandogli l'email

**Cosa fa:** se un amico "✓ Su Hinthial" cambia email, il collegamento (e la foto reale mostrata) ora si azzera subito, invece di restare agganciato all'account di prima. Si ricollega da solo se la nuova email corrisponde a un altro account.

**Note tecniche:** `updateFriend()` non toccava mai `linked_user_id`, e `checkLinkedAccounts` riprova il collegamento solo per chi non ne ha già uno --- combinati, un amico già collegato non veniva più ricontrollato per il resto della sua vita. `EditFriendForm` confronta ora l'email scritta con quella originale e passa un flag `emailChanged` a `updateFriend()`, che azzera `linked_user_id` nella stessa scrittura (mai `avatar_path`, indipendente dall'email).


### Ottimizzazioni di velocità: meno un giro di rete per pagina, meno codice caricato a vuoto

**Cosa fa:** le pagine dovrebbero rispondere un po' più svelte, in particolare la prima interazione dopo il login e il passaggio da una sezione all'altra. Non un cambiamento visibile in interfaccia --- solo meno lavoro superfluo dietro le quinte a ogni navigazione.

**Note tecniche:** misurato con un confronto reale dev-vs-produzione (che ha anche confermato che gran parte della "lentezza" percepita durante lo sviluppo è dovuta a Turbopack che compila ogni pagina al primo accesso di ogni sessione dev --- normale, e assente in produzione). Due interventi concreti trovati comunque validi: (1) `getCurrentUser()` non richiama più `supabase.auth.getUser()` (un giro di rete verso il server di autenticazione) ma legge la sessione già verificata pochi istanti prima da `src/proxy.ts`, il cui matcher copre ogni pagina qui interessata --- da lì in poi nella stessa richiesta non serve verificarla una seconda volta. (2) La libreria `qrcode` (usata solo per il QR del kit di recovery, in `SetupMasterKeyForm`) è passata da un import statico --- che la spediva con ogni pagina protetta da `RequireMasterKey`, quindi quasi ovunque nell'app, anche per chi ha configurato la cifratura da tempo --- a un import dinamico, caricato solo nell'istante in cui serve davvero. Verificato che non venga più scaricata visitando una sezione qualunque.


### "Novità" diventa una voce di menu a sé, non più una card in Dashboard

**Cosa fa:** la card "Novità" e il suo pannello laterale sono spariti dalla Dashboard --- al loro posto, una nuova voce nel menu principale, "Novità", apre una pagina a sé (come Cronologia, ma senza filtri) con le ultime 10 modifiche a Hinthial in tabella, dalla più recente, e un tasto "Vedi tutte" per il resto.

**Note tecniche:** `ProductUpdatesWidget` rimosso; `UpdatesPanel` (nuova pagina `/updates`) riusa lo stesso `domain/product-updates/repository.ts` --- un solo caricamento di tutte le righe, "Vedi tutte" si limita a mostrarne il resto senza una seconda richiesta. Voce di menu con `requiresEncryption: false` (come Dashboard): contenuto globale, non serve la master key.

### Voci del menu principale: quali mostrare, e in che ordine

**Cosa fa:** in Impostazioni > Aspetto puoi ora scegliere quali voci compaiono nel menu di navigazione principale (barra laterale o orizzontale), e in quale ordine --- stesso meccanismo già usato per la barra in basso su smartphone, applicato qui alla barra principale su ogni dispositivo.

**Note tecniche:** nuova colonna `profiles.main_nav_items` (jsonb, come `bottom_nav_items`) e `lib/main-nav.ts`/`MainNavItemsProvider`/`useOrderedNavItems()`, consumato da Sidebar/TopNav (l'intero elenco) e MobileNavBar (il cassetto, meno le voci già nella barra in basso). A differenza della barra in basso, qui nascondere una voce non lascia un "altrove" dove ritrovarla: resta comunque raggiungibile da Dashboard o dalla ricerca globale.

### Impostazioni: Aspetto a due colonne, contenuto a piena larghezza ovunque

**Cosa fa:** in Impostazioni > Aspetto le sezioni (Tema, Disposizione del menu, Voci del menu, Barra in basso, Liste, Capsule) si affiancano su due colonne quando lo schermo è abbastanza largo. In generale, il contenuto di ogni scheda di Impostazioni usa ora tutta la larghezza disponibile, invece di restare compresso in una colonna stretta anche su schermi ampi.

### Onboarding: rispetta "Nascondi" anche in Dashboard

**Cosa fa:** una volta scelto "Nascondi" per il gadget Onboarding, la checklist non ricompare più nemmeno come card in Dashboard --- prima spariva solo dalla barra di navigazione. La primissima volta (prima di aver mai scelto "Nascondi") continua a comparire in entrambi i posti, come sempre.

### Foto di un amico/del profilo: fotocamera e galleria, ognuna il suo tasto

**Cosa fa:** "Carica foto" apre sempre la scelta di un file esistente (la galleria su smartphone); "Scatta foto" apre sempre la fotocamera --- prima capitava che entrambi aprissero la fotocamera su smartphone. Su computer, "Scatta foto" ora accende davvero la webcam del dispositivo, con un'anteprima dal vivo, invece di aprire la solita finestra di scelta file.

**Note tecniche:** due `<input type="file">` distinti invece di uno solo con `capture` attivato/disattivato al volo (quel trucco dipende dal blur per ripristinarsi, che su alcuni browser/OS mobile non scatta mai dopo aver annullato la fotocamera). Su desktop, `getUserMedia` con un fotogramma catturato su `<canvas>`, alimentato nello stesso ritaglio a quadrato già esistente.


### Amici: foto profilo, anche per gli account collegati

**Cosa fa:** ogni amico può avere una foto, in elenco, in tabella e nella pagina di modifica. La carichi tu (con lo stesso ritaglio a quadrato già usato per la tua foto profilo, e ora anche "📷 Scatta foto" oltre a "Carica foto" --- comparso anche nelle tue Impostazioni, per coerenza) --- oppure, se quell'amico è già un account Hinthial collegato, vedi automaticamente la sua foto vera, senza doverla caricare tu. Una foto caricata a mano vince sempre su quella reale. Senza nessuna delle due, le iniziali di nome e cognome su uno sfondo colorato, come per il tuo profilo.

**Note tecniche:** `AvatarPickerCrop` estrae il ritaglio già scritto per `AvatarUploadForm` (canvas, drag, zoom) in un componente riusabile, condiviso ora da profilo e amico; il tasto "Scatta foto" riusa il trucco già in Archivio (`capture="environment"` impostato un istante prima del click, tolto subito dopo). Nuova colonna `friends.avatar_path` (bucket `avatars`, pubblico, in chiaro --- stesso principio già accettato per l'avatar del profilo), path `{owner_id}/friend-{friend_id}-{ts}.jpg`: nessuna nuova policy di Storage necessaria, la cartella resta quella di chi carica. Per la foto reale di un account collegato, niente accesso diretto alla sua riga `profiles` (che nel tempo si è riempita di parecchie colonne non pertinenti --- preferenze, consensi IA, data di nascita): una funzione dedicata `get_linked_friend_avatar_path` (SECURITY DEFINER, stesso schema di `lookup_friend_account`) restituisce solo il path della sua foto, verificando che chi chiama possieda davvero quella riga `friends`. Risolta in `FriendsPanel` in un passaggio a parte (`resolveLinkedAvatar`), mai bloccando il caricamento dell'elenco.

### Il "Nome" degli amici diventa "Nome visualizzato"; aggiunti Nome e Cognome

**Cosa fa:** in Amici, il campo che finora si chiamava "Nome" ora si chiama "Nome visualizzato" --- è lo stesso campo di sempre, solo con un nome più preciso su cosa fa: decide cosa vedi in elenco e in tabella. Accanto, due nuovi campi facoltativi, Nome e Cognome: compilandoli, il Nome visualizzato si aggiorna da solo come "Nome Cognome", finché non lo tocchi direttamente --- da quel momento resta quello che hai scritto, anche continuando a correggere nome o cognome.

**Note tecniche:** `encrypted_name` (rinominato solo concettualmente, nessuna migrazione: resta la stessa colonna) affiancato da due nuove colonne cifrate `encrypted_first_name`/`encrypted_last_name`, nullable --- gli amici già esistenti restano "" decifrati, mai un errore. La sincronizzazione "Nome Cognome" -> Nome visualizzato vive lato client (`displayNameEdited`, un booleano che smette di seguire dopo il primo tocco diretto sul campo); in modifica, lo stato iniziale di quel booleano si deduce confrontando il nome visualizzato già salvato con "nome cognome" attuale --- se combaciano è ancora "automatico", altrimenti si considera già personalizzato (copre da sé anche gli amici creati prima che nome/cognome esistessero).

### Novità in Dashboard: la storia di Hinthial raccontata a te

**Cosa fa:** dove ci sono i contatori, in Dashboard, una nuova sezione "Novità" mostra le ultime 5 modifiche fatte a Hinthial, spiegate in modo amichevole e rivolte direttamente a te --- non i dettagli tecnici del changelog di sviluppo, solo cosa cambia per chi usa l'app. Un tasto "Vedi tutte" apre un pannello laterale con tutta la storia, cercabile.

**Note tecniche:** nuova tabella `product_updates` (title, description, published_on) --- la prima dell'app senza `owner_id`: contenuto uguale per tutti gli utenti, una sola policy RLS (`select` per chi è autenticato, `using (true)`) e nessuna policy di scrittura per il client: si popola solo da migrazioni, mai da un'azione dell'interfaccia. Backfill storico ispirato al changelog di sviluppo ma curato a mano (non ogni voce tecnica lì merita una riga qui) e riscritto in seconda persona. `ProductUpdatesWidget` carica l'intero elenco una sola volta (poche decine di righe), mostra le prime 5 e filtra il resto lato client nel pannello "Vedi tutte" (stesso `SidePanel`/`SearchInput` già usati per il dettaglio di un'attività).

### Il countdown delle capsule diventa un cartellino che scatta; puoi nasconderlo

**Cosa fa:** il conto alla rovescia verso l'apertura di una capsula (in elenco, in tabella --- ora in una colonna propria "Tra quanto" --- e nell'anteprima) è ora un cartellino animato che segna giorni, ore, minuti e secondi, aggiornato dal vivo mentre lo guardi: giorni/ore/minuti scattano con un piccolo "flip" meccanico, i secondi si limitano a cambiare numero (scattare ogni secondo sarebbe frenetico invece che piacevole). Oltre i 100 giorni un numero secco sostituisce i cartellini; una volta raggiunta la data, un badge "🔓 Disponibile da adesso" al loro posto. Se preferisci un'interfaccia più essenziale, un nuovo interruttore in Impostazioni > Aspetto lo nasconde ovunque.

**Note tecniche:** `computeCountdownParts` (nuovo, in `lib/capsule-countdown.ts`) scompone il tempo restante per difetto (mai arrotondato, a differenza dell'etichetta testuale già esistente, che resta la fonte dell'aria-label di accessibilità --- non ricalcolata al secondo, per non spammare chi usa uno screen reader). Un solo `setInterval` al secondo condiviso da ogni `CapsuleCountdown` montato nella pagina (`use-countdown-tick.ts`), non uno per riga. Nuova colonna `profiles.capsule_countdown_visible` (default true), letta/scritta da `CapsulesPanel`/`CapsuleCountdownSettings`.


### Il conto alla rovescia della capsula scende a ore e minuti; compare solo dopo la chiusura

**Cosa fa:** quando manca meno di un giorno all'apertura di una capsula, il conto alla rovescia non dice più genericamente "oggi" --- ti dice "si aprirà tra 16 ore", e sotto l'ora "si aprirà tra 14 minuti". Inoltre ora lo vedi solo sulle capsule chiuse (o condivise): su una bozza non compare più, dato che lì la data di apertura può ancora cambiare e un conto alla rovescia non avrebbe senso.

**Note tecniche:** `computeCountdown` (`lib/capsule-countdown.ts`) ora ramifica sulla differenza esatta in millisecondi da `openAt`, non solo sulla differenza di data di calendario: sotto le 24h mostra le ore intere, sotto l'ora i minuti interi (entrambi arrotondati e con singolare/plurale corretto; clampati rispettivamente a 23 e 59 per evitare che un arrotondamento al bordo mostri "24 ore" o "60 minuti"). Sopra le 24h il comportamento resta quello di prima (giorni interi, "domani" per esattamente un giorno). `CapsulesPanel` mostra `CapsuleCountdown` solo quando `status !== "draft"`.

### La data di apertura di una capsula diventa data e ora

**Cosa fa:** quando crei o modifichi una capsula, "Si aprirà il ..." ora chiede anche l'orario, non solo il giorno --- lo stesso calendario nativo dello smartphone/browser, con in più la scelta dell'ora. Ovunque compaia una data di apertura (elenco Capsule, anteprima, "Condivise con me", il conteggio alla rovescia) viene mostrata con l'orario incluso.

**Note tecniche:** `CapsuleOpenAtField` passa da `<input type="date">` a `<input type="datetime-local">` --- la conversione da/verso il formato locale "YYYY-MM-DDTHH:mm" richiesto dall'input resta un dettaglio interno del componente: verso l'esterno `value`/`onChange` restano un ISO datetime (UTC), come ogni altra data dell'app (stesso principio già usato per `reminders.due_at`). Colonna `capsules.open_at` da `date` a `timestamptz`. Il conto alla rovescia (`lib/capsule-countdown.ts`) continua deliberatamente ad arrotondare ai giorni interi nell'etichetta ("Si aprirà tra N giorni") --- non ne serviva una più precisa, solo il momento scelto doveva poter includere l'ora.

## 2026-09-12

### "Condivise con me" dentro Capsule (FASE B della condivisione capsule)

**Cosa fa:** in Capsule c'è ora una scheda "Condivise con me", accanto a "Le mie" --- elenca le capsule che altri amici (già collegati a un account Hinthial, v. voce precedente) hanno condiviso con te: da chi, quando, e quando è prevista l'apertura. Il contenuto vero e proprio non è ancora consultabile --- lo sarà con una fase futura, quando arriverà anche lo scambio di chiavi necessario a decifrarlo; per ora è solo il collegamento e i metadati già in chiaro. Se un amico riceve una capsula prima ancora di essersi registrato su Hinthial, non la perde: non appena il suo account viene riconosciuto (v. voce precedente), la capsula compare comunque in "Condivise con me", retroattivamente.

**Note tecniche:** nuova tabella `capsule_shares` (capsule_id, owner_id, recipient_user_id, shared_at) --- creata da `shareCapsule()` per ogni destinatario già collegato a un account nel momento in cui si preme "Condividi", e retroattivamente da `syncCapsuleSharesForLinkedFriend()` quando `FriendsPanel` scopre più tardi che un amico si è registrato (stessa verifica in background della Fase A, ora anche fonte per questa sincronizzazione). Due nuove policy RLS (`capsules_select_shared_recipient`, `profiles_select_shared_by_owner`) lasciano al destinatario la sola lettura di stato/data apertura della capsula e nome del mittente --- l'`encrypted_payload` resta comunque illeggibile per lui quanto lo è già per il server, nessuna concessione di riservatezza a dargli la riga intera. `listCapsulesSharedWithMe()` risolve tutto in due query batch (mai una per capsula). Verificato end-to-end con due account reali, includendo lo scenario retroattivo per intero: A condivide con un'email non ancora registrata, quell'account si registra dopo, il collegamento scatta al prossimo caricamento di Amici, e la capsula compare da sola in "Condivise con me" di quell'account.

### Hinthial riconosce da solo quali amici hanno un account (FASE A della condivisione capsule)

**Cosa fa:** in Amici, ogni amico la cui email corrisponde a un account Hinthial registrato mostra ora un badge "✓ Su Hinthial" --- anche se si è registrato *dopo* essere stato aggiunto o invitato. Ogni volta che apri la pagina, gli amici non ancora riconosciuti vengono ricontrollati in automatico, senza bisogno di fare nulla apposta. Non concede ancora alcun accesso: è solo il primo passo (di quattro) verso poter davvero condividere il contenuto di una capsula con chi la riceve.

**Note tecniche:** nuova colonna `friends.linked_user_id`, risolta da una nuova funzione Postgres `lookup_friend_account(target_email)` (SECURITY DEFINER, stesso principio di `log_failed_login_attempt`) che verifica una singola email alla volta contro `auth.users`/`profiles` --- mai un elenco, mai un confronto bulk, perché l'email dell'amico resta cifrata con la Master Key di chi lo ha aggiunto e il server non può leggerla da sé. A differenza di `log_failed_login_attempt`, qui rivelare la corrispondenza è proprio lo scopo (non un effetto collaterale da evitare): per mitigare l'uso della funzione come oracolo per enumerare account registrati, un tetto di 200 verifiche al giorno per chi chiama (`friend_lookup_attempts`, mai esposta al client). Lato client, `FriendsPanel` ricontrolla ad ogni caricamento solo gli amici con `linkedUserId` ancora nullo, in sequenza e in background, senza bloccare la pagina né disturbare l'utente in caso di fallimento (si riprova al prossimo caricamento). Verificato end-to-end con due account reali: A aggiunge B come amico dopo che B si è già registrato --- il badge compare al caricamento e resta dopo un refresh vero.

### "Contatti fiduciari" diventa "Amici"; il flag "amico" diventa "Guardiano"

**Cosa fa:** la sezione prima chiamata "Contatti"/"Contatti fiduciari" ora si chiama **Amici** ovunque nell'app --- voce di menu, titoli di pagina, url (`/friends` invece di `/contacts`), esportazione dati, ricerca globale, cronologia, registro Attività. Il flag interno che segnala chi riceve un avviso informale in caso di lunga inattività (in precedenza "amico") diventa **Guardiano**, per non sovrapporsi al nuovo nome della sezione --- semanticamente è anche più preciso: un guardiano è letteralmente qualcuno a cui affidi un ruolo di tutela.

**Note tecniche:** rinominati route (`src/app/(app)/contacts` → `friends`), componenti (`TrustedContactsPanel` → `FriendsPanel`, `ContactPicker` → `FriendPicker`, `CreateContactForm`/`EditContactForm` → `CreateFriendForm`/`EditFriendForm`), dominio (`domain/contacts` → `domain/friends`, `TrustedContactListItem` → `FriendListItem`, `isFriend` → `isGuardian`), e ogni punto che referenziava l'entità come chiave interna (`ListSection`, `ImportKind`, `AuditEventCategory`, `TimelineEntryKind`, contatori dashboard, contesto AI). Migrazione DB (`20260912020000_contacts_to_friends.sql`): tabella `trusted_contacts` → `friends`, colonna `is_friend` → `is_guardian`, indice/trigger/policy/vincolo di chiave esterna rinominati di conseguenza, tipo di evento audit `trusted_contact_added` → `friend_added` (righe già registrate durante lo sviluppo riscritte prima di stringere il vincolo). Formato di esportazione dati (`ExportManifest`) portato a `hinthialExportVersion: 2` per lo stesso motivo (`trustedContacts` → `friends`). Nessun dato reale da preservare (progetto in sviluppo, v. README) --- migrazione applicata direttamente, nessun redirect da `/contacts` predisposto.

### Ridotto al minimo lo spazio riservato in fondo lista per il "+" in sovraimpressione

**Cosa fa:** in Archivio, Beni, Contatti, Scadenze e Capsule, lo spazio vuoto lasciato in fondo alla lista su smartphone per non far coprire l'ultima riga dal "+" (v. voce precedente) ora è molto più piccolo --- resta giusto un margine, non più una fascia vuota vistosa.

**Note tecniche:** il fix precedente calcolava il padding-bottom da zero rispetto al fondo reale dello schermo (`9.5rem`, cioè l'intero ingombro del FAB più margine), ignorando che `<main>` (v. AppShell) riserva già `pb-24` (6rem) sotto `md` per non far finire i contenuti sotto la barra di navigazione fissa --- le due riserve si sommavano invece di sottrarsi, lasciando un vuoto ben più grande del necessario (misurato ~134px). Corretto calcolando solo la differenza: il FAB arriva a 8.5rem dal fondo reale (altezza + bottom-offset), 2.5rem oltre ai 6rem già riservati da `<main>` --- il padding qui copre solo quella differenza più mezzo rem di margine (`pb-[calc(3rem+env(safe-area-inset-bottom))] sm:pb-0`). Riverificato con lo stesso scenario di prima (12 scadenze, scroll fino in fondo, click reale sul tasto "⋮" dell'ultima riga): margine sceso da ~134px a ~30px, ancora senza sovrapposizione.

### Bug corretto: il "+" in sovraimpressione bloccava il menu azioni dell'ultima riga di una lista

**Cosa fa:** in Archivio, Beni, Contatti, Scadenze e Capsule, arrivati in fondo a una lista lunga su smartphone, il tasto "⋮" delle azioni delle ultime righe non finisce più coperto dal "+" tondo --- ora resta sempre pienamente raggiungibile.

**Note tecniche:** il FAB occupa sempre lo stesso rettangolo fisso in basso a destra dello schermo (`position: fixed`); scrollando fino in fondo, l'ultima riga di una lista abbastanza lunga finiva proprio lì sotto, e il tocco veniva intercettato dal FAB (z-index più alto) invece che dal tasto "⋮" della riga (v. RowActionsMenu). Riservato, sotto `sm`, un padding-bottom sul contenitore di ognuno dei cinque componenti pari all'ingombro del FAB più un margine (`pb-[calc(9.5rem+env(safe-area-inset-bottom))] sm:pb-0`): l'ultima riga si ferma ora sempre sopra il FAB. Verificato creando 12 scadenze, scorrendo fino in fondo e cliccando davvero il tasto "⋮" dell'ultima --- prima del fix il click sarebbe stato intercettato dal FAB.

### Su smartphone, il tasto "aggiungi" diventa un "+" tondo in sovraimpressione

**Cosa fa:** in Archivio, Beni, Contatti, Scadenze e Capsule, su smartphone il tasto per creare un nuovo contenuto non è più affiancato al titolo di pagina --- è ora un pulsante rotondo blu con un "+", fisso in basso a destra sopra la barra di navigazione rapida, sempre raggiungibile senza scorrere la pagina. Al tocco porta alla stessa schermata di creazione di sempre (es. "Aggiungi capsula" apre "Nuova capsula"). Su desktop e tablet nulla cambia: resta il tasto normale accanto al titolo.

**Note tecniche:** nuovo componente condiviso `MobileAddFab.tsx` (link con `aria-label` descrittivo, `position: fixed`, `sm:hidden`); il tasto originale in ciascuno dei cinque componenti diventa `hidden sm:block`, così sotto `sm` scompare del tutto e il FAB lo sostituisce, invece di scendere su una riga propria come nella modifica precedente.

### Barra di navigazione in basso: 5 voci invece di 4, e ora riordinabili da Impostazioni

**Cosa fa:** in Impostazioni > Aspetto > "Barra di navigazione in basso (smartphone)" si possono ora scegliere fino a 5 voci (prima 4) per la barra fissa in basso su smartphone, e soprattutto se ne può scegliere l'ordine: l'elenco "Nella barra" si trascina con mouse o dito per riordinarlo, oppure si spostano le voci su/giù con le frecce ▲▼ (più comode da tastiera o senza trascinamento); "Altre voci" resta l'elenco da cui aggiungerne di nuove in fondo.

**Note tecniche:** `MAX_BOTTOM_NAV_ITEMS` da 4 a 5 (`lib/bottom-nav.ts`). Corretto anche un bug per cui `BottomNavBar.tsx` ignorava del tutto l'ordine scelto: renderizzava sempre le voci nell'ordine fisso di `NAV_ITEMS`, filtrate su quelle scelte, invece che nell'ordine memorizzato in `profiles.bottom_nav_items` --- riordinare non aveva mai avuto alcun effetto visibile finché non risolto qui. `BottomNavItemsSettings.tsx` riscritto: due elenchi separati (selezionate, ordinate secondo l'array `items`, con maniglia di trascinamento nativa HTML5 Drag and Drop + frecce ▲▼ + tasto ✕ per togliere; non selezionate, con checkbox per aggiungere) invece dell'unico elenco di sole checkbox di prima.

### Su smartphone, il tasto "aggiungi" scende sotto il titolo per lasciare tutta la larghezza alla descrizione

**Cosa fa:** in Archivio, Beni, Contatti, Scadenze e Capsule, su smartphone il tasto "+ Aggiungi/Crea" ora compare in una riga propria sotto titolo e descrizione, invece di stare affiancato sulla stessa riga del titolo --- la descrizione guadagna così tutta la larghezza dello schermo invece di doversi stringere nello spazio lasciato libero dal tasto, andando a capo su meno righe e liberando spazio in verticale per i contenuti veri e propri sotto. Su desktop e tablet nulla cambia: titolo, descrizione e tasto restano affiancati come prima.

**Note tecniche:** la fix precedente (`min-w-0 flex-1` sul contenitore titolo+descrizione) risolveva lo spreco di spazio orizzontale ma non lo "sfratto": quel contenitore condivideva comunque la riga col tasto per tutta la sua altezza, quindi la larghezza disponibile restava comunque ridotta della larghezza del tasto --- più evidente quanto più lungo il testo del tasto ("+ Crea capsula" più largo di "+ Crea bene"). Cambiato il contenitore esterno da `flex items-start justify-between gap-4` a `flex flex-col items-start gap-4 sm:flex-row sm:justify-between` in tutti e cinque i componenti, col contenitore titolo+descrizione `w-full sm:flex-1`: sotto la soglia `sm` (640px) il tasto scende su una riga propria a piena larghezza; da `sm` in su il layout torna quello di sempre. Verificato con screenshot Playwright a 375px e 1280px.

### Intestazione allineata nelle pagine con tasto "aggiungi": titolo e descrizione ora usano tutta la larghezza

**Cosa fa:** in Archivio, Beni, Contatti, Scadenze e Capsule, la descrizione sotto il titolo di pagina non va più a capo prematuramente lasciando spazio vuoto prima del tasto "+ Aggiungi/Crea" --- ora occupa tutta la larghezza disponibile, sia su desktop (dove titolo, descrizione e tasto stanno sulla stessa riga) sia su smartphone (dove il tasto scende sotto, restando allineato a sinistra come il titolo).

**Note tecniche:** il contenitore di titolo+descrizione, dentro la riga flessibile che lo affianca al tasto, non aveva `flex-1` --- restava largo solo quanto il proprio contenuto (shrink-to-fit) invece di espandersi allo spazio residuo della riga, così la `<p>` andava a capo prima del dovuto. Aggiunto `min-w-0 flex-1` al contenitore in tutti e cinque i componenti (`DocumentsPanel.tsx`, `AssetsPanel.tsx`, `TrustedContactsPanel.tsx`, `RemindersPanel.tsx`, `CapsulesPanel.tsx`); il tasto affiancato aveva già `shrink-0`, quindi resta sempre alla sua dimensione piena. `TimelinePanel.tsx` (Cronologia) escluso perché non ha un tasto "aggiungi". Verificato a 1280px e 375px con screenshot Playwright ad-hoc prima di confermare.

### Capsule: descrizione più corta, spiegazione completa solo su richiesta

**Cosa fa:** sotto il titolo di Capsule ora compare una sola riga breve, invece del paragrafo lungo di prima --- su smartphone occupava la maggior parte dello schermo. Il dettaglio completo (cosa succede chiudendo una capsula, che l'originale resta libero, che l'accesso reale ai destinatari arriverà in futuro) resta disponibile aprendo "Come funziona chiudere una capsula", non più imposto in cima alla pagina.

**Note tecniche:** nessuna perdita di sicurezza --- l'avviso sull'irreversibilità della chiusura era già ripetuto nella conferma al momento di chiudere una capsula per davvero (v. `handleClose`, `window.confirm`), quindi il paragrafo fisso era ridondante, non l'unica rete di sicurezza. Disclosure nativa (`<details>`/`<summary>`), nessun nuovo stato React.

### Bug corretto: icone di Impostazioni quasi invisibili sulle schede con nome lungo

**Cosa fa:** le icone di "Informazioni utente" e "Intelligenza artificiale" nel menu di Impostazioni non erano più piccole delle altre per scelta grafica --- si schiacciavano quasi fino a sparire, perché le loro etichette (le più lunghe dell'elenco) non ci stavano nella colonna della barra laterale. Ora restano sempre alla loro dimensione piena, come tutte le altre.

**Note tecniche:** le icone non avevano `flex-shrink: 0` --- in un contenitore flessibile stretto (`md:w-48`), col testo impostato a non andare a capo, l'unico elemento libero di restringersi per far stare tutto era l'icona, fino quasi a zero pixel di larghezza per l'etichetta più lunga. Aggiunto `shrink-0` alle icone (mai più responsabili di "assorbire" lo spazio mancante) e allargata la colonna della barra laterale da `md:w-48` a `md:w-60`, come margine di sicurezza per le etichette più lunghe. Diagnosticato misurando la vera `boundingBox()` delle icone renderizzate (7px e 0px di larghezza invece di 20px) prima di intervenire, non a occhio.

### "Intelligenza artificiale" è ora una scheda a sé in Impostazioni

**Cosa fa:** il consenso all'IA reale (cancello generale + funzione Chat) non vive più dentro la scheda Privacy --- ha ora una sua scheda dedicata, "Intelligenza artificiale", allo stesso livello di Informazioni utente/Sicurezza/Privacy/Categorie. Anche il rimando dalla pagina AI (quando il cancello è spento) punta ora lì. In più, le icone delle schede di Impostazioni sono state ingrandite (18px --- la misura più piccola di tutta l'app --- a 20px, come altrove).

**Note tecniche:** `PrivacyPanel.tsx` tornato alla sua forma precedente (solo il riepilogo "Cosa sa Hinthial di te"); `AIConsentSettings` ora renderizzato da un nuovo caso `"ai"` in `SettingsTabs.tsx`. `ai-processing-consent.spec.ts` aggiornato di conseguenza.

### Consenso all'IA reale a due livelli: cancello generale + funzioni specifiche

**Cosa fa:** in Impostazioni > Privacy compare una nuova sezione "Intelligenza artificiale" con un interruttore generale ("Consenti l'uso di IA esterna") --- spento di default. Da solo non attiva nulla: sblocca solo la possibilità di accendere, una per una, le funzioni specifiche elencate sotto (oggi solo "Chat", in futuro altre). Lo stesso interruttore della Chat resta anche nella pagina AI, sincronizzato con quello di Impostazioni --- se ci arrivi senza aver acceso il cancello generale, lo trovi visibile ma disattivato, con un rimando a dove accenderlo. Spegnere il cancello generale spegne anche tutte le funzioni specifiche insieme; riaccenderlo non le riaccende da solo, restano a scelta esplicita una per una. Ogni domanda che raggiunge davvero Claude lascia ora anche una traccia in Impostazioni > Attività.

**Note tecniche:** `profiles.ai_processing_consent` rinominata in `ai_chat_consent` (specifica della Chat) + nuova colonna `ai_master_enabled` (il cancello) --- `updateAIMasterEnabled` spegne entrambe in un solo aggiornamento quando disattivato, mai il contrario. `AIProcessingConsentProvider` espone ora `masterEnabled`/`chatConsent` distinti. La route `/api/ai/chat` riverifica entrambi i valori sul database (non il solo stato client) prima di procedere, e registra un nuovo tipo di evento audit (`ai_chat_used`) dopo una risposta riuscita. Nuovo componente `AIConsentSettings.tsx`, stesso pattern a elenco di `ListViewSettings.tsx`. `ai-processing-consent.spec.ts` riscritto per il percorso a due livelli.

## 2026-09-10

### FASE 11 --- prima fetta di HINTHIAL AI reale ("Explicit AI processing")

**Cosa fa:** nella pagina AI compare un interruttore "Attiva risposte reali" (spento di default): una volta attivato, le domande vengono elaborate da Claude (Anthropic) invece che dal solo motore locale --- prima ancora di attivarlo, tutto resta come oggi (nessun dato lascia il dispositivo). Anche da attivo, solo la domanda e i pochi elementi dei tuoi dati effettivamente pertinenti vengono inviati, mai l'intero archivio, e mai il testo delle capsule (solo titolo/stato/data). La scelta è sincronizzata su tutti i dispositivi, come la disposizione del menu.

**Note tecniche:** implementa il vincolo di privacy di HINTHIAL_MVP.md sezione 8 ("Explicit AI processing", una delle due modalità previste insieme a "Local/private AI", non ancora costruita). Nuova colonna `profiles.ai_processing_consent` (booleano, sincronizzato come `nav_orientation`) + `AIProcessingConsentProvider`. Il retrieval resta locale e gratuito (`mockAIProvider.retrieve()`, già corretto per parole chiave/relazioni): decide QUALI elementi sono pertinenti prima che un byte lasci il dispositivo; solo quelli vengono proiettati sui campi essenziali (`domain/ai/claude-provider.ts`, `projectSource`) e inviati alla nuova route server-side `POST /api/ai/chat`, l'unico punto di contatto con l'API Anthropic (`ANTHROPIC_API_KEY` solo lì, mai `NEXT_PUBLIC_*`) --- la route riverifica il consenso sul valore salvato nel database, non fidandosi del solo stato client. Se nessun elemento locale corrisponde alla domanda, non parte alcuna chiamata di rete. Modello `claude-opus-5` (default del progetto). Nuovi test: unit per `claude-provider.ts` (fetch mockato), e2e `ai-processing-consent.spec.ts` che verifica l'intero percorso reale --- incluso il messaggio di errore quando `ANTHROPIC_API_KEY` non è ancora configurata --- senza spendere una vera chiamata a Claude.

### "Asset" rinominato in "Beni"

**Cosa fa:** la sezione che prima si chiamava "Asset" (immobili, veicoli, account, contratti, assicurazioni, ...) si chiama ora "Beni" in tutta l'app --- menu di navigazione, contatori della dashboard, moduli di creazione/modifica, messaggi di conferma ed errore, assistente AI, ricerca globale, cronologia, importazione/esportazione CSV, e la conferma di "Cancella tutto". Era l'unica voce di navigazione rimasta in inglese, e "asset" suonava più contabile/tecnico di quanto serva per qualcosa che copre anche casa, auto e polizze.

**Note tecniche:** rinomina di sola interfaccia --- come già per "Documenti" -> "Archivio" (v. FASE 14), nomi di file/cartelle/route/colonne DB restano in inglese (`/assets`, `AssetIcon`, `AssetListItem`, `relatedAssetId`, `assets.*` in Supabase, ...), dato che "asset" ne è già la traduzione inglese corretta --- non serviva introdurne una diversa per le URL. L'assistente AI mock riconosce ora "bene"/"beni" come parole scatenanti per "elencameli tutti" (`LIST_ALL_TRIGGERS` in `mock-provider.ts`), non più "asset". Il template CSV di importazione (`domain/import/templates.ts`) usa ora `beni` come prefisso del nome del file scaricato, in linea con gli altri template (`contatti-fiduciari`, `scadenze`), che erano già in italiano. Aggiornati tutti gli e2e e unit test che asserivano sul testo "Asset"/"asset".

### Impostazioni su smartphone: elenco -> dettaglio invece della fila di schede

**Cosa fa:** su smartphone, Impostazioni mostra ora un elenco di voci (Informazioni utente, Sicurezza, Privacy, ...); toccandone una si vede solo il suo contenuto, con un tasto "← Torna alle impostazioni" per uscirne --- invece della fila di schede orizzontale scorrevole di prima. Da desktop non cambia nulla: le schede restano sempre visibili tutte insieme, con il contenuto a fianco.

**Note tecniche:** due blocchi indipendenti in `SettingsTabs.tsx` (`md:hidden` per il cassetto mobile, `hidden md:flex` per le schede desktop), non un solo layout responsive --- condividono la stessa funzione `renderPanel(activeTab)` per non duplicare la logica di quale pannello mostrare. Transizione con dissolvenza (`useCrossfade`, già usata per il cambio scheda da desktop) tra elenco e dettaglio. Nuovo e2e `mobile-settings-nav.spec.ts`.

### Tasto "Scatta foto" per aggiungere contenuto all'Archivio da smartphone

**Cosa fa:** nel modulo "Carica un file" di un nuovo contenuto d'Archivio, su smartphone compare un tasto "📷 Scatta foto" accanto alla scelta file --- apre direttamente la fotocamera del telefono invece della libreria file. Su desktop non compare (non avrebbe un vantaggio pratico lì).

**Note tecniche:** nessun secondo `<input type="file">` nel DOM (rompendo il selettore generico usato da molti e2e) --- lo stesso input riceve gli attributi `accept="image/*"`/`capture="environment"` un istante prima del click programmatico, poi li perde al `blur` (chiusura della finestra di scelta, con o senza foto), tornando al comportamento normale per un click successivo diretto sull'input.

### Vista a elenco forzata su smartphone, dove la tabella non ha spazio

**Cosa fa:** su schermi stretti, ogni sezione con liste (Archivio, Scadenze, Asset, Contatti, Capsule, Cronologia) mostra sempre la vista a elenco, anche se la preferenza salvata è "tabella" --- che lì non avrebbe spazio per restare leggibile. La preferenza resta comunque intatta e si applica di nuovo su uno schermo più largo; l'interruttore rapido di ogni sezione si nasconde su smartphone (mostrerebbe una scelta senza effetto visibile), quello in Impostazioni > Aspetto resta invece sempre disponibile.

**Note tecniche:** nuovo `useMediaQuery` (stesso meccanismo di `ThemeToggle` per "prefers-color-scheme", generalizzato); `ListViewPreferencesProvider.modeFor` forza `"list"` sotto i 768px, a monte delle 6 sezioni, senza toccarne il codice. `ListViewToggle` accetta un prop `hideOnMobile` (usato dalle pagine di sezione, non da `ListViewSettings`, che resta sempre visibile).

### Barra di navigazione fissa in basso su smartphone

**Cosa fa:** nell'esperienza smartphone compare ora una barra fissa in basso con le voci di navigazione scelte dall'utente (fino a 4) --- si scelgono in Impostazioni > Aspetto, con una casella per voce; quelle non scelte restano raggiungibili come prima dal menu con le 3 lineette, che ora mostra solo il resto (niente più doppioni tra le due). Di default: Dashboard, Archivio, Scadenze, Capsule.

**Note tecniche:** nuova colonna `profiles.bottom_nav_items` (jsonb, un array di href) sincronizzata sul server come `nav_orientation` --- stesso pattern "valore iniziale letto lato server" (v. `BottomNavItemsProvider`, `getCurrentUser`), non il fetch lato client lazy di `list_view_preferences`, per evitare un lampo delle icone sbagliate in una chrome persistente della shell. `MainNav` accetta ora un prop opzionale `items` (di default l'elenco completo `NAV_ITEMS`) per poter mostrare un sottoinsieme nel cassetto mobile senza toccare Sidebar/TopNav. Nuovi file: `lib/bottom-nav.ts` (tipo, default, parser sicuro), `BottomNavItemsProvider.tsx`, `BottomNavBar.tsx`, `BottomNavItemsSettings.tsx`. Nuovo e2e (`bottom-nav.spec.ts`): voci di default in barra, personalizzazione da Impostazioni con esclusione reciproca dal menu con le 3 lineette, persistenza al refresh, disabilitazione delle caselle oltre le 4 voci --- `mobile-nav.spec.ts` aggiornato di conseguenza ("Archivio" ora di default in basso, non più nel cassetto).

### Bug corretto: la dissolvenza tra le schede di Impostazioni non cambiava mai contenuto

**Cosa fa:** cliccando una scheda diversa in Impostazioni, il contenuto non passava più alla scheda scelta (restava fermo su "Informazioni utente", la prima) --- corretto lo stesso giorno in cui la dissolvenza era stata introdotta.

**Note tecniche:** `useCrossfade` faceva sia lo scambio del contenuto mostrato sia la programmazione del fade-in nello stesso effetto React. Lo scambio (`setDisplayed`) aggiornava una dipendenza di quell'effetto, facendolo ripartire da capo --- la sua "pulizia" (cleanup) cancellava il frame d'animazione appena programmato un istante prima per il fade-in, che quindi non scattava mai: il contenuto restava tecnicamente aggiornato ma invisibile (opacità 0) per sempre dopo il primo cambio scheda. Diviso in due effetti indipendenti --- uno si occupa solo di aspettare e scambiare il contenuto, l'altro (con la propria dipendenza e la propria pulizia separate) solo di dissolverlo dentro una volta scambiato. Verificato con 16 e2e che passano per le schede di Impostazioni (prima il bug non li faceva fallire perché nessuno aspettava l'animazione per verificare il contenuto --- solo l'uso reale, con l'attesa visiva della dissolvenza, lo rendeva evidente).

### Vista a elenco delle capsule: senza il testo del messaggio

**Cosa fa:** l'elenco delle capsule non mostra più il testo del messaggio --- si legge già aprendo "Modifica" o l'anteprima ("Così la vedrà chi la riceve"), ripeterlo anche nell'elenco era ridondante. Il resto della riga (titolo, stato, destinatari, allegati) resta invariato.

**Note tecniche:** rimossa la sola riga di rendering in `CapsulesPanel.tsx` --- il dato (`capsule.content`) resta comunque usato per la ricerca testuale. Due e2e che verificavano il testo direttamente nella riga ora lo verificano aprendo l'anteprima.

### Dashboard: niente più scorrimento orizzontale su smartphone

**Cosa fa:** su schermi stretti, contatori e card della dashboard restano sempre entro i bordi dello schermo, senza il piccolo movimento orizzontale antiestetico segnalato --- margini e simmetria della pagina restano quelli di sempre.

**Note tecniche:** due interventi complementari. (1) `min-w-0` sui contenitori flex/grid della dashboard (`DashboardCounters`, `DashboardWidgets`) --- senza, un elemento a larghezza intrinseca (es. un nome file lungo senza spazi in "Aggiunti di recente") può far sì che l'elemento, e con esso la colonna/griglia che lo contiene, non si restringa mai sotto quella larghezza, sporgendo oltre lo schermo: `minmax(0, 1fr)` sulle tracce della griglia (già presente via le utility `grid-cols-N` di Tailwind) non basta da solo, serve anche sull'elemento dentro la traccia. (2) `overflow-x: hidden` su `html`/`body` come rete di sicurezza, per eventuali arrotondamenti di un pixel che un layout comunque corretto può produrre --- non sostituisce il punto (1), lo completa.

### Dashboard: "Da tenere d'occhio" in una riga a sé

**Cosa fa:** il riquadro "Da tenere d'occhio" non sta più nella colonna stretta insieme a "Onboarding" --- ha ora una riga propria a piena larghezza, lasciando alla colonna larga (contatori, scadenze, aggiunti di recente) e a quella stretta (Onboarding) più spazio ciascuna.

**Note tecniche:** `DashboardWidgets.tsx` --- la griglia a due colonne (`lg:grid-cols-[2fr_1fr]`) ora contiene solo Onboarding nella colonna stretta; `WatchlistWidget` è una riga a sé subito sotto, fuori dalla griglia.

### Animazioni di entrata/uscita per barra laterale, menu mobile, pannelli e popup

**Cosa fa:** diversi passaggi dell'interfaccia che prima scattavano di colpo ora sono fluidi: comprimere/espandere la barra laterale, aprire/chiudere il menu mobile (scorre da sinistra), aprire/chiudere un pannello laterale a tutto schermo (Onboarding, dettaglio Attività --- scorrono da destra, con lo sfondo scurito che compare/scompare insieme), passare da una scheda all'altra in Impostazioni (dissolvenza), aprire/chiudere il popup di ricerca globale e l'anteprima di una capsula (dissolvenza).

**Note tecniche:** due piccoli hook condivisi, nessuna libreria di animazione aggiunta. `useMountedTransition(open, durationMs)` (`lib/use-mounted-transition.ts`) tiene un elemento montato per tutta la durata della transizione di uscita invece di smontarlo di scatto insieme allo stato che lo controlla (altrimenti React lo toglierebbe dal DOM prima che l'animazione possa anche solo iniziare) --- usato da `MobileNavBar`, dal nuovo `components/ui/SidePanel.tsx` (estratto da `OnboardingStatus`/`AuditLogPanel`, che condividevano già lo stesso identico markup per il pannello laterale, ora anche la stessa animazione), da `GlobalSearch` e da `CapsulePreview`. `useCrossfade(value, durationMs)` (`lib/use-crossfade.ts`) gestisce invece una dissolvenza tra due contenuti diversi (non un mount/unmount) --- usato da `SettingsTabs` per il cambio di scheda.

Due dettagli tecnici non ovvi:
- Il "mount" deve avvenire nello **stesso render** in cui `open` diventa vero, non un render dopo tramite un effetto --- altrimenti un effetto del chiamante che dipende anch'esso da `open` (es. dare il focus al campo di ricerca appena aperto, in `GlobalSearch`) troverebbe l'elemento non ancora nel DOM. Risolto con lo stesso pattern che React stesso documenta per "adattare lo stato quando cambia una prop" (confronto durante il render, non un `useRef` --- la configurazione ESLint di questo progetto vieta di leggere `ref.current` durante il render).
- `CapsulePreview` e il dettaglio di `AuditLogPanel` sono ora sempre montati (mai più condizionati a "c'è qualcosa da mostrare?"): il contenuto passato può tornare `null` prima che l'animazione di uscita sia finita, quindi ognuno tiene un "ultimo valore non nullo mostrato" a parte, così il contenuto resta visibile (e corretto) per tutta la dissolvenza invece di sparire a metà.

---

## 2026-09-09

### Anteprima capsula più larga

**Cosa fa:** il popup "Così la vedrà chi la riceve" è ora più largo su schermi ampi --- su mobile resta invariato (si adatta già alla larghezza dello schermo).

**Note tecniche:** `max-w-lg` (512px) → `max-w-3xl` (768px) → `max-w-4xl` (896px, su richiesta) in `CapsulePreview.tsx` --- solo il limite massimo, il `w-full` e il padding del contenitore esterno che già gestiscono il responsive non sono cambiati.

### Le capsule scritte come una lettera, non un form

**Cosa fa:** scrivere e modificare una capsula ha ora il tono di una lettera, non di un modulo da compilare --- dal mockup condiviso con l'utente ("capsule come lettere"). I destinatari sono mostrati come si indirizzerebbe una busta (iniziali colorate + nome, sotto l'etichetta "A"), la data di apertura è una frase ("Si aprirà il ...") invece di un campo anonimo, e il messaggio si scrive in una vera superficie di carta calda --- non più una piccola textarea grigia identica a ogni altro campo --- con un interruttore "Scrittura semplice / A mano" che passa il testo a un font manoscritto (Caveat): una scelta di chi scrive, salvata con la capsula, così chi la riceve la vede esattamente come l'ha lasciata. Gli allegati audio/video sono ora un'aggiunta discreta dietro "+ Aggiungi un allegato", non un passo alla pari con lo scrivere. L'anteprima ("Così la vedrà chi la riceve") mostra il messaggio nella stessa carta calda, nello stesso font scelto.

**Note tecniche:** nuovo campo `contentStyle` ("simple" | "handwritten") in `CapsulePayload`/`CapsuleListItem`/`CapsuleInput`/`CapsuleEditInput` (`domain/capsules/types.ts`, `repository.ts`) --- come ogni altro campo del payload, cifrato insieme al resto, mai una colonna in chiaro; le capsule create prima che esistesse tornano "simple" di default. Nuovi componenti condivisi tra creazione e modifica: `CapsuleOpenAtField` (un `<input type="date">` reale, solo senza il riquadro attorno --- stesso nome accessibile "Data di apertura" di sempre) e `CapsuleLetterEditor` (la superficie di scrittura + l'interruttore di stile). `ContactPicker` mostra ora i destinatari già scelti con iniziali su un cerchio colorato invece dell'emoji 👤. Font Caveat caricato via `next/font/google` (solo peso 600, l'unico usato). Il campo "Contenuto" è stato rinominato "Il tuo messaggio" (nome accessibile incluso --- aggiornate le e2e che lo referenziavano per nome); gli allegati, ora dietro un rivelatore, hanno richiesto lo stesso aggiornamento in 4 test e2e che ci interagivano direttamente.

### Hinthial installabile come app (PWA)

**Cosa fa:** Hinthial può ora essere installata sul dispositivo (icona sulla home/nel launcher, si apre senza la barra degli indirizzi del browser) --- su Android/Chrome/Edge il browser propone da sé l'installazione; su iOS/Safari va aggiunta a mano (Condividi -> "Aggiungi alla schermata Home", Safari non offre un prompt automatico). L'icona è ricavata dal logo Hinthial (anche la favicon nella tab del browser, che fino a oggi mostrava ancora il triangolo segnaposto di default di Next.js, mai sostituito).

**Note tecniche:** `app/manifest.ts` (Next.js lo serve da sé su `/manifest.webmanifest` e lo collega nell'`<head>`, nessun `<link rel="manifest">` a mano) con `display: "standalone"` e `start_url: "/dashboard"` (le route protette reindirizzano già al login chi non è autenticato, v. middleware). Icone in due varianti da `public/brand/logo.svg`: "any" (trasparenti, per i contesti che le mostrano così com'è) e "maskable" (sfondo blu brand pieno con più margine, per Android che le ritaglia con una propria maschera --- senza il margine extra il ritaglio avrebbe tagliato foglie/anello del logo). `public/sw.js`: service worker minimo, richiesto dai browser per l'installabilità --- **nessuna cache offline**, di proposito: metterne una richiederebbe decidere con cura se e come conservare contenuti già decifrati sul dispositivo, cosa che oggi lo zero-knowledge non prevede, non un effetto collaterale di questa modifica. Favicon (`favicon.ico`) rigenerata a mano in formato multi-risoluzione (16/32/48px, nessuna libreria terza --- `System.Drawing` non scrive .ico multi-size da sé).

### Bug corretto: modificare una capsula/un contenuto d'Archivio poteva silenziosamente scartare le modifiche

**Cosa fa:** modificare il titolo (o la data di apertura) di una capsula esistente a volte non salvava la modifica --- l'elenco continuava a mostrare il titolo vecchio, pur mostrando "Capsula aggiornata." Lo stesso rischio esisteva, non ancora osservato, nella modifica dei metadati di un contenuto d'Archivio (categoria/asset/scadenza/tag/note).

**Note tecniche:** causa individuata investigando il bug segnalato in precedenza --- l'effetto che carica i dati esistenti nel form (`refresh()`, chiamato una volta al mount) viene invocato **due volte** in sviluppo da React StrictMode (comportamento intenzionale, pensato apposta per far emergere bug come questo). Senza protezione, se la prima invocazione (superata) risolve *dopo* la seconda, il suo risultato sovrascrive silenziosamente titolo/data/ecc. anche se l'utente li ha già modificati nel frattempo --- il form è visibile solo a caricamento già completato, quindi l'unico modo in cui questo può succedere è una seconda fetch "fantasma" in corso in background. Riprodotto in modo affidabile (75% delle volte su 4 tentativi) isolando il test e2e delle capsule; dopo la correzione, 6/6 e un'intera suite e2e passano. Corretto in `EditCapsuleForm.tsx` ed `EditArchiveItemForm.tsx` (gli unici due form di modifica con campi controllati popolati da `refresh()` --- `EditAssetForm`/`EditContactForm` usano campi non controllati via `defaultValue`, quindi non erano vulnerabili) con un contatore di richieste (`useRef`) che scarta il risultato di una fetch superata, stesso principio del flag `cancelled` già usato in `MasterKeyProvider`.

### Titolo di ogni pagina: stesso carattere del logo, colore brand

**Cosa fa:** il titolo principale di ogni pagina (es. "Capsule", "Archivio", "Ciao, ..."), prima nero e in un font generico, usa ora lo stesso carattere della scritta "Hinthial" nel logo (Baloo 2, identificato a occhio nella conversazione precedente) ed è del blu del brand, invece di nero --- un'estensione visiva del logo stesso. I titoli più piccoli (dentro le card, le sezioni) restano su Manrope, invariati.

**Note tecniche:** Baloo 2 caricato via `next/font/google` in `layout.tsx`, applicato solo a `h1` in `globals.css` (staccato dalla regola `h2`-`h6`, che resta Manrope). Il colore non può essere impostato da quella stessa regola CSS: ogni `<h1>` ha già una classe Tailwind di colore sul proprio elemento (`text-zinc-950 dark:text-zinc-50`), e una classe vince sempre su un semplice selettore d'elemento come `h1 { color: ... }` --- corretto quindi cambiando quella classe in `text-brand`, direttamente su ognuno dei 29 file che hanno un `<h1>` (stesso identico frammento di classe, letterale, ovunque). Esclusa la hero della homepage (ha già un accento blu solo su una parola, via uno `<span>` --- l'intero titolo diventerebbe blu, perdendo quel contrasto) e il titolo del kit di recovery stampabile in `SetupMasterKeyForm` (colori fissi per la stampa, non seguiva già la regola dark/chiaro). Non escluse le due intestazioni di errore/successo in "Verifica account" (`AlertTriangleIcon`/`CheckCircleIcon` restano nel proprio rosso/verde, solo il titolo sopra diventa blu) --- segnalato all'utente come possibile eccezione da rivedere.

### Pagine di inserimento/modifica a piena larghezza

**Cosa fa:** le pagine di inserimento e modifica di Archivio, Asset, Contatti fiduciari, Scadenze e Capsule usano ora tutta la larghezza disponibile della pagina, invece di restare compresse in una colonna centrale --- il comportamento responsive (a schermi stretti i campi vanno a capo esattamente come prima) resta inalterato.

**Note tecniche:** rimosso `max-w-2xl` dal contenitore esterno in tutti e 9 i file (stesso identico `<div className="flex max-w-2xl flex-col gap-6">` ripetuto ovunque). I campi dentro non hanno richiesto altre modifiche per sfruttare lo spazio: sono già organizzati con `flex-wrap`/`flex-1` (i campi "Nome"/"Titolo" si allargano, gli altri restano alla loro larghezza naturale, e a schermi stretti vanno semplicemente a capo, come sempre) --- rimuovere solo il limite massimo era sufficiente. Aggiunto anche `w-full` ai campi Tag/Note in `DocumentMetadataFields` (condiviso da creazione e modifica in Archivio), per coerenza esplicita anche fuori da un contesto flex che già li allargava implicitamente.

### Icona "Informazioni utente" allineata alle altre in Impostazioni

**Cosa fa:** l'icona della scheda "Informazioni utente" in Impostazioni non appare più più piccola delle altre.

**Note tecniche:** `UserIcon` (`icons/nav-icons.tsx`) --- stessa dimensione di riquadro (`width`/`height` già uguali per tutte le icone di Impostazioni), ma la sua geometria (testa+spalle sottili) riempiva meno del riquadro rispetto a icone più "piene" come `SecurityIcon`. Testa e spalle allargate per occupare lo stesso spessore visivo.

### Icona lucchetto aperto sul bottone "Sblocca"

**Cosa fa:** il bottone "Sblocca" (master password o recovery key) ha ora un'icona a forma di lucchetto aperto.

**Note tecniche:** nuova `UnlockedIcon` in `icons/nav-icons.tsx` --- stesso lucchetto di `SecurityIcon` (usata in Impostazioni > Sicurezza e nel badge zero-knowledge della homepage), ma con il gancio staccato dal corpo invece di richiuderlo.

### Identità visiva "Fresh Clarity" su homepage e schermate di autenticazione

**Cosa fa:** la homepage pubblica e le schermate di login, registrazione, verifica account (riuscita o no) e password dimenticata adottano lo stesso stile delle direzioni viste nel mockup (v. "FreshHero"): sfondo grigio-azzurro con una "bolla" mint decorativa dietro l'hero, badge "Zero-knowledge davvero" con icona lucchetto sopra il titolo, bottone principale con freccia e ombra colorata, card più arrotondate con ombra leggera. Le pagine di login/registrazione/verifica ora vivono dentro una vera card bianca (prima galleggiavano nude sullo sfondo); "Account verificato"/"Verifica non riuscita" hanno un'icona di stato (spunta verde/triangolo di attenzione), come altrove nell'app.

**Note tecniche:** la "bolla" è un `background` (radial-gradient) su un `<div aria-hidden>` assoluto dentro un contenitore `relative overflow-hidden` --- non un'immagine posizionata, quindi non può alterare le dimensioni della pagina né aggiungere barre di scorrimento (stessa lezione imparata nel canvas di design). Un solo `<main>` per pagina (la tentazione era di farne due, uno per l'hero con la bolla e uno per il resto --- non valido: due landmark "main" confondono la struttura della pagina per chi usa uno screen reader). `(auth)/layout.tsx` (condiviso da login/registrazione/verifica/password dimenticata/controlla email) avvolge il contenuto in una card, invece di ogni pagina per conto proprio.

Verificando con l'intera suite e2e (non solo gli unit test) sono emersi due problemi, entrambi corretti:
- **21 asserzioni e2e** in 11 file cercavano ancora il vecchio testo con l'emoji (`"✅ Asset creato."`, `"⚠️ Non attiva"`, ecc.) rimossa in una modifica precedente di oggi (icone di sistema) --- non erano coperte dagli unit test, solo dalle e2e, che non erano ancora state rilanciate da quella modifica.
- La nuova frase "Hai già un account? Accedi" nell'hero della homepage duplica il link "Accedi" già presente in alto (come nel mockup) --- corretto **2 test** (`home.spec.ts`, `auth-shell.spec.ts`) che cercavano quel link per nome su tutta la pagina, ora scoped al banner in alto.

**Bug scoperto, non di questa modifica**: `capsules.spec.ts` --- dopo aver modificato il titolo di una capsula già creata, l'elenco non mostra il titolo aggiornato (il messaggio "Capsula aggiornata." compare correttamente, ma la riga con il nuovo titolo non si trova). Riproducibile due volte su due, non collegato a nessuna modifica di oggi (verificato sul diff) --- segnalato all'utente, non ancora investigato a fondo.

### Icone in Impostazioni, icone di sistema color-logo, dati personali affiancati

**Cosa fa:** tre ritocchi mirati --- (1) ogni scheda della pagina Impostazioni ha ora un'icona a linea accanto all'etichetta, nello stesso stile della barra di navigazione; (2) tutte le icone "di sistema" (nav, contatori in dashboard, schede di Impostazioni) sono dello stesso blu del logo Hinthial, invece di un grigio neutro o del solo stato attivo --- eccetto "Zona pericolosa", che resta nel proprio rosso di avviso perché segnala un rischio, non solo una sezione; (3) in Impostazioni > Informazioni utente > Dati personali, Nome/Cognome/Data di nascita sono ora affiancati su schermi larghi (uno sotto l'altro solo su mobile), invece di essere sempre in colonna --- l'unica delle tre sezioni del pannello a poter sfruttare la piena larghezza della pagina (le altre due, Avatar ed Email, restano un solo campo ciascuna).

**Note tecniche:** 7 nuove icone in `icons/nav-icons.tsx` (utente, lucchetto, occhio, importa/esporta, checklist, attività, cursori). Il colore non è più ereditato dallo stato del testo circostante (`currentColor` dal genitore) ma passato esplicitamente come `className="text-brand"` su ogni icona --- altrimenti lo sfondo azzurrino della voce attiva (`bg-brand/10`) avrebbe reso l'icona invisibile se fosse rimasta forzata a un altro colore fisso. Scheda Impostazioni riportata alla stessa pillola della nav (`bg-brand/10 text-brand` da attiva, prima `bg-brand text-white`), per coerenza. `UserInfoPanel`: rimosso `max-w-md` dal contenitore esterno (limitava tutte e tre le sezioni), ridato singolarmente ad Avatar ed Email; i tre campi di "Dati personali" affiancati via **container query** (`@container`/`@xl:grid-cols-3`, non `sm:`/`md:`) --- reagiscono alla larghezza vera disponibile per il pannello, non a quella della finestra: a schermi medi, dove barra laterale ed elenco schede (v. SettingsTabs) occupano già buona parte dello spazio, un breakpoint legato alla sola finestra li avrebbe affiancati comunque, lasciando pochissimo spazio per scrivere in ognuno (bug segnalato dall'utente subito dopo, corretto nella stessa giornata).

### Identità visiva: colore e tipografia "Fresh Clarity"

**Cosa fa:** l'accento blu usato in bottoni, link e stati attivi in tutta l'app è più vivo (era un blu campionato dal logo, ora un blu più acceso), e i titoli passano da un font generico a Manrope (il resto del testo a Work Sans) --- la direzione visiva scelta dopo aver mostrato ad Andrea alcune proposte di stile, per un'identità meno "anonima".

**Note tecniche:** il colore è cambiato in un solo punto (`--brand`/`--brand-hover` in `globals.css`) --- quasi tutta l'app usa già queste variabili invece di classi Tailwind fisse (`bg-brand`, non `bg-blue-600`), quindi si è propagato senza toccare i singoli componenti. Font caricati via `next/font/google` in `layout.tsx` (Manrope, Work Sans), applicati globalmente in `globals.css`: Work Sans su `body` (prima Arial/Helvetica fisso), Manrope su tutti i tag `h1`-`h6` (prima nessuna regola, ereditavano il font del body). Geist Mono resta solo per il testo a spaziatura fissa (codici di recupero/MFA). Il logo (`logo-lockup.svg`) era già quello ufficiale con scritta in tutta l'app, nessuna modifica lì.

### Identità visiva: icone di sistema "Fresh Clarity"

**Cosa fa:** quarta parte del restyle --- le icone della barra di navigazione, dei contatori in dashboard e dei badge di stato (fatto/da fare, ok/attenzione, in tutta l'app) non sono più emoji ma icone a linea disegnate, nello stesso stile del mockup. Le emoji restano invece dove sono una scelta dell'utente (icona di una categoria) o un ornamento nel testo di un bottone (es. "🎥 Registra video", "📅 Esporta calendario") --- non toccate, sono fuori da questa fase.

**Note tecniche:** nuovo `components/icons/nav-icons.tsx`, un set di icone SVG (24x24, `stroke="currentColor"`, così ereditano il colore del testo del chiamante invece di uno fisso incollato dentro --- utile soprattutto in nav, dove lo stato attivo/hover cambia colore). `NavItem.icon` e l'analogo campo in `DashboardCounters` sono passati da `string` (emoji) a un componente React. Nuovo `components/ui/SuccessMessage.tsx`: il messaggio "✅ X creato/aggiornato." dopo un salvataggio, identico in 5 pannelli (Asset, Capsule, Contatti, Archivio, Scadenze --- 9 occorrenze), estratto in un solo componente invece di ripetere l'icona in ognuno. I pochi badge di stato "a mano" (Impostazioni > Onboarding/MFA, il messaggio di reimpostazione account) hanno preso l'icona direttamente, senza passare dal componente condiviso. Aggiornato un test (`main-nav.test.tsx`) che verificava la vecchia emoji per nome: ora verifica che l'icona sia un SVG `aria-hidden`, non nel nome accessibile del link.

### Identità visiva: bottoni e nav attiva "Fresh Clarity"

**Cosa fa:** terza parte del restyle --- i bottoni principali (blu, testo bianco) hanno angoli più smussati come nel mockup; la voce attiva nella barra di navigazione non è più un riquadro blu piatto con testo bianco, ma una pillola azzurro chiarissimo con testo blu, coerente con l'estetica più leggera del resto.

**Note tecniche:** stesso approccio delle card --- individuato il pattern letterale ricorrente `rounded-md bg-brand ... hover:bg-brand-hover` (54 occorrenze in 34 file, ogni bottone primario dell'app) e portato a `rounded-xl`; escluse deliberatamente le due righe che condividono la stessa forma ma sono altro (una voce selezionata in un elenco a comparsa in `GlobalSearch`, un segmento di un toggle a due stati in `CreateArchiveItemForm` --- quest'ultimo lasciato intatto perché i suoi due stati devono restare identici come raggio). Nav attiva (`MainNav.tsx`): `bg-brand text-white` diventato `bg-brand/10 text-brand` --- il modificatore `/10` di Tailwind (10% di opacità del colore `brand` già definito come token) invece di un secondo colore fisso da mantenere in sync, funziona automaticamente sia su sidebar bianca che su sfondo scuro.

### Identità visiva: angoli, ombre e sfondo "Fresh Clarity"

**Cosa fa:** seconda parte del restyle --- le card e i contenitori con bordo in tutta l'app (dashboard, liste, form, pannelli di Impostazioni) hanno angoli più arrotondati e un'ombra leggera che li stacca dallo sfondo, che è ora un grigio-azzurro molto chiaro invece di bianco puro; barra laterale, barra in alto e barra mobile restano bianche, per contrasto. Solo aspetto: nessun cambiamento a come la barra di navigazione o le pagine si adattano allo schermo.

**Note tecniche:** individuato il pattern ricorrente `rounded-lg border border-zinc-200 ... dark:border-zinc-800` (52 occorrenze in 35 file --- praticamente ogni "card"/lista/riquadro dell'app usava già le stesse classi) e sostituito con uno script mirato: raggio portato a `rounded-2xl`, aggiunti `bg-white`/`shadow-[0_8px_20px_rgba(16,24,40,0.04)]` (e l'equivalente `dark:bg-zinc-950`) solo dove non c'era già uno sfondo esplicito diverso --- le modali (`MasterKeyIntroModal`, `GlobalSearch`, ecc.) e i riquadri con sfondo intenzionalmente diverso (es. il box "Quello che non vedremo mai" in Privacy, `bg-zinc-50`) hanno preso solo il nuovo raggio, non un secondo sfondo/ombra sopra quello che avevano già. `--background` (chiaro) passato da `#ffffff` a `#f7fafb`; `Sidebar`/`TopNav`/`MobileNavBar`, che prima non dichiaravano uno sfondo proprio (mostravano semplicemente quello della pagina), ora dichiarano `bg-white` esplicito per restare bianche mentre il resto della pagina diventa grigio-azzurro. Il tema scuro non è cambiato (la direzione "Fresh Clarity" non ne prevede uno).

---

## 2026-09-08

### Email inviate da Hinthial: invito contatto, cancellazione/reset account

**Cosa fa:** tre funzionalità che inviano email vere, la prima volta che Hinthial lo fa da sé (finora solo Supabase Auth inviava email, per conferma registrazione e reset password):
- **Invita un contatto**: nel form di creazione/modifica di un contatto fiduciario, una checkbox "Invita questo contatto su Hinthial" --- se spuntata, all'salvataggio parte un'email all'indirizzo del contatto con un link a Hinthial e uno diretto alla registrazione. Un invio non riuscito non impedisce di salvare il contatto, solo un avviso a parte.
- **Cancella il tuo account** (nuova sezione in Impostazioni > Zona pericolosa): cancella per sempre l'account e ogni dato collegato --- non solo il vault come "Reimposta l'account" qui sotto, ma l'account stesso: non è più possibile accedere con quelle credenziali. Richiede di reinserire la master password, oltre a una frase di conferma testuale. Un'email di conferma arriva all'indirizzo dell'account.
- **Reimposta l'account** (prima "Cancella tutto", rinominata): stesso svuotamento di sempre (Archivio, Asset, Contatti fiduciari, Capsule, categorie ripristinate ai valori predefiniti), ma ora richiede anche la master password prima di procedere, e invia un'email di conferma a operazione completata.

**Note tecniche:** email inviate via l'API REST di Resend (`src/lib/email/send-email.ts`, una chiamata fetch diretta, nessuna dipendenza in più), da Server Actions (`src/lib/contacts/actions.ts`, `src/lib/account/actions.ts`) --- mai dal browser: `RESEND_API_KEY` non deve mai lasciarlo. La cancellazione account usa `auth.admin.deleteUser` (richiede la service role key, prima usata solo dai test): ogni riga collegata all'account ha già `ON DELETE CASCADE` da `auth.users` nelle migrazioni esistenti, quindi sparisce da sé --- solo gli oggetti di Storage (non dati di Postgres) vengono ripuliti a mano, enumerati per prefisso (`src/lib/storage/wipe-owner-storage.ts`). La master password, in entrambe le sezioni di Zona pericolosa, viene verificata riprovando a sbloccare (`useMasterKey().unlockWithPassword`) --- l'unico modo per verificarla davvero, dato lo zero-knowledge: il server non la vede mai.

### Popup "Crea la tua master key" al primo accesso

**Cosa fa:** subito dopo il login, chi non ha ancora configurato la cifratura vede un popup che spiega la differenza tra password dell'account e master password, con un tasto "Crea la tua master key" che porta dritto al modulo di creazione. Compare una sola volta: qualunque modo di chiuderlo (✕, "Più tardi", sfondo, o il tasto stesso) lo segna come visto per sempre, e comunque smette di avere senso non appena la cifratura è configurata. Resta comunque, come sempre, anche una voce a sé nel checklist di onboarding.

**Note tecniche:** `profiles.master_key_intro_seen` (sincronizzato sul server, come `onboarding_widget_hidden`). Il confronto a due righe tra le due password è stato estratto in `PasswordComparisonNote`, condiviso con il modulo di creazione stesso (`SetupMasterKeyForm`) per non avere due copie dello stesso testo. Nei test e2e, un `page.addLocatorHandler()` (`tests/e2e/fixtures.ts`) lo chiude automaticamente per ogni test che non lo riguarda esplicitamente --- altrimenti, essendo un overlay a tutto schermo, avrebbe bloccato il primo click di quasi tutta la suite.

### Onboarding: meno "scatola", più spiegazione

**Cosa fa:** il checklist "Onboarding" (nel pannello laterale del gadget e in Dashboard) non ha più il riquadro attorno alla lista, e sotto il titolo spiega in una riga di cosa si tratta.

### Onboarding: pannello laterale invece del riquadro flottante

**Cosa fa:** il click sul gadget "Onboarding" nella barra di navigazione apre ora un pannello laterale a tutto schermo (lo stesso pattern del dettaglio attività in Impostazioni > Attività), invece di un piccolo riquadro ancorato al pulsante --- da quando ogni passo mostra anche una breve descrizione, il contenuto era diventato troppo alto per il vecchio riquadro flottante.

**Note tecniche:** rimosso tutto il calcolo di posizione/spazio disponibile (coordinate del pulsante, margine minimo, lato di apertura) --- un pannello ancorato al bordo destro dello schermo non ne ha più bisogno.

### Prima esperienza: meno disorientamento al primo accesso

**Cosa fa:** cinque correzioni mirate al percorso di chi usa Hinthial per la prima volta, prima ancora di aver configurato la cifratura:
- Il modulo "Configura la cifratura" spiega ora esplicitamente la differenza tra password dell'account e master password (un confronto a due righe), e anticipa cosa aspettarsi ("un minuto: password, chiave di recupero, poi sei dentro").
- L'indicatore "Onboarding" nella barra di navigazione e la card in Dashboard mostrano già i primi due passi (account creato, cifratura da configurare) **prima** di aver sbloccato il vault, invece di restare del tutto assenti fino ad allora --- un punto di partenza esplicito appena si atterra in dashboard.
- Il checklist "Onboarding" completo (8 passi) mostra ora una breve spiegazione sotto ogni passo non ancora fatto, non solo l'etichetta --- utile soprattutto per passi che introducono un concetto nuovo (es. "Aggiungi un amico", legato al Dead Man's Switch delle capsule).
- L'ordine dei passi mette prima quelli concreti (contenuto, categoria, asset, capsula) e per ultimi quelli che presuppongono un concetto nuovo (amico/Dead Man's Switch, collegamento capsula-contatto).
- Le voci della barra di navigazione che richiedono la cifratura (tutte tranne Dashboard) mostrano un piccolo pallino finché non è stata configurata --- prima ancora di cliccarci sopra, invece di scoprire lo stesso modulo di setup separatamente su ognuna.

**Note tecniche:** il pallino è espresso via `aria-describedby` su uno `<span>` a parte, mai testo dentro l'etichetta del link: il nome accessibile resta invariato ("Archivio", non "Archivio (richiede...)"), altrimenti ogni ricerca per nome esatto (screen reader o test) smetterebbe di trovare il link finché la cifratura non è configurata.

**Note tecniche:** nuova `computeBasicOnboardingSteps()` in `domain/onboarding/steps.ts` --- gli stessi due oggetti-passo (`account`/`security`) usati anche dalla checklist completa, mai due definizioni separate che potrebbero disallinearsi. Il loro stato non richiede la Master Key (letto da `useMasterKey().status`), a differenza degli altri 6 passi che restano dietro sblocco perché richiedono dati decifrati.

### Data di nascita nel profilo

**Cosa fa:** in Impostazioni > Informazioni utente e nella schermata di registrazione, un nuovo campo facoltativo "Data di nascita", accanto a nome e cognome.

**Note tecniche:** `profiles.birth_date` (date, nullable), in chiaro come nome/cognome --- un dato anagrafico, non del vault. Passata a `signUp()` come `options.data.birth_date`, letta da `handle_new_user()` allo stesso modo di nome/cognome.

### Impostazioni: schede riorganizzate e in verticale

**Cosa fa:** le schede di Impostazioni (Informazioni utente, Sicurezza, Privacy, Categorie, Importa/Esporta, Onboarding, Attività, Aspetto, Zona pericolosa) sono ora una barra verticale a sinistra su schermi larghi (resta una barra orizzontale scorrevole su mobile), in un nuovo ordine.

### Correzione: il gadget "Onboarding" nascosto poteva ricomparire

**Cosa fa:** "Nascondi" nel pannello del gadget Onboarding nella barra di navigazione ora vale per davvero, anche a un login successivo (o su un altro dispositivo) --- non solo per il browser in cui è stato cliccato. Resta comunque riattivabile da Impostazioni > Onboarding.

**Note tecniche:** la preferenza (`profiles.onboarding_widget_hidden`) è passata da solo-`localStorage` a sincronizzata sul server, con lo stesso pattern già usato per `nav_orientation` (letta lato server in `getCurrentUser()`, aggiornamento ottimistico lato client con rollback se il salvataggio fallisce). `lib/onboarding-widget.ts` (il vecchio helper `localStorage`) è stato rimosso.

### Impostazioni > Privacy: lista aggiornata

**Cosa fa:** la lista di "Quello che vediamo" ora riflette anche la data di nascita (se impostata), la visibilità del gadget di onboarding, e segnala che IP/dispositivo/browser di ogni accesso ed eventuali tentativi falliti sono registrati in Impostazioni > Attività.

### Impostazioni > Attività: registro interrogabile, con molti più eventi

**Cosa fa:** invece di caricare sempre tutto il registro, ora si interroga: data inizio, data fine e categoria (scelta multipla), poi "Trova" mostra i risultati in una tabella; un click su una riga apre un pannello laterale con i dettagli (metodo di login, indirizzo IP, dispositivo/browser, quando presenti). Nuovi eventi registrati: tentativi di login falliti, verifiche MFA fallite, attivazione/rimozione dell'autenticazione a due fattori, generazione di codici di backup, distinzione tra login con password/TOTP/codice di backup, IP e dispositivo/browser di ogni login riuscito, e creazione/eliminazione di asset, capsule e categorie (oltre a documenti/contatti, già presenti).

**Note tecniche:** `audit_events` ha una nuova colonna `metadata jsonb` (mai contenuti o identificatori, solo dettagli tecnici) invece di continuare a esplodere l'enum `event_type` per ogni sfumatura. Un tentativo di login con password errata non ha ancora una sessione autenticata (`auth.uid()` è null, le RLS richiederebbero `auth.uid() = owner_id`): registrato tramite una funzione Postgres dedicata (`log_failed_login_attempt`, `SECURITY DEFINER`) che non rivela mai se l'email corrisponde a un account esistente, per non permettere l'enumerazione degli account. IP/user agent letti da `next/headers` lato server action (`lib/http/request-context.ts`). Il raggruppamento per giorno (`domain/audit/group.ts`) è stato rimosso: la vista è ora tabellare, non più a elenco raggruppato.

**Bug noto, scoperto ma non risolto (pre-esistente, non introdotto da queste modifiche):** in `/login`, dopo un primo tentativo con credenziali sbagliate, un secondo submit del form (anche con la password corretta) non naviga alla dashboard --- riproducibile anche disabilitando del tutto la nuova registrazione dei tentativi falliti, quindi non è la causa. Verosimilmente un'interazione tra `useActionState`/Server Actions e i cookie di sessione scritti dal primo tentativo. Da investigare a parte: nel frattempo un refresh della pagina prima di riprovare aggira il problema.

### Menu di navigazione responsive

**Cosa fa:** su schermi piccoli, la barra laterale (o quella orizzontale) è sostituita da un tasto menu (☰) che apre la stessa navigazione in sovraimpressione, invece di restare sempre visibile occupando spazio.

**Note tecniche:** nuovo `MobileNavBar`, montato sempre da `AppShell` accanto a `Sidebar`/`TopNav` (nascosti sotto la soglia `md` via CSS, non smontati: così la barra laterale non perde il proprio stato di compressione attraversando la soglia).

### Cronologia: filtri per data e sezione

**Cosa fa:** in Cronologia, un nuovo filtro iniziale per data inizio, data fine e sezione (Archivio/Asset/Scadenza/Contatto/Capsula), applicato subito senza bisogno di un tasto "Cerca" --- i dati sono già tutti decifrati in memoria.

---

## 2026-09-07

### MFA: codici di backup

**Cosa fa:** in Impostazioni > Sicurezza, oltre all'app authenticator (TOTP) è ora possibile generare **10 codici di backup monouso**, da usare se si perde l'accesso al proprio dispositivo: uno vale al posto del codice, e viene consumato subito dopo l'uso. Compaiono solo se hai già l'app authenticator attiva.

**Note tecniche:** i codici di backup sono interamente nostri (Supabase non li supporta nativamente): salvati come hash SHA-256 (Web Crypto API) in una nuova tabella `mfa_backup_codes`, mai in chiaro se non per l'istante in cui vengono mostrati. Un dettaglio non ovvio emerso testando: verificare un codice di backup non è una vera verifica MFA per Supabase, quindi non alza da sé il livello di sicurezza (AAL) della sessione --- un cookie dedicato (`lib/auth/mfa-bypass.ts`) segna esplicitamente "secondo fattore verificato con un codice di backup" per i controlli d'accesso, cancellato ad ogni nuovo login perché non deve valere oltre la sessione in cui è stato ottenuto.

**Esplorato ma non implementato: passkey (WebAuthn) come fattore alternativo.** L'idea era di poter verificare con impronta digitale/Face ID/Windows Hello/chiave fisica invece di un codice, usando l'MFA WebAuthn nativo di Supabase (`factorType: "webauthn"`, orchestrato a mano in tre passi dato che l'SDK non espone un metodo di comodo completo per questo). Il codice è stato scritto e verificato fino al punto in cui il server Supabase lo permetteva, ma il dashboard Authentication di questo progetto non espone alcun modo per attivare "WebAuthn come fattore MFA" --- solo per il login primario con passkey ("Passkeys" BETA), una funzionalità diversa pensata per sostituire la password, non per affiancarla. Rimosso dal codice in attesa che Supabase chiarisca/rilasci un percorso stabile per questo caso d'uso specifico.

### Autenticazione a due fattori (TOTP)

**Cosa fa:** nuova scheda "Sicurezza" in Impostazioni per attivare l'autenticazione a due fattori con un'app come Google Authenticator o 1Password. Una volta attiva, dopo email e password il login chiede anche un codice a 6 cifre prima di entrare. Si possono registrare più dispositivi (consigliato farlo, per non restare esclusi dall'account perdendo l'unico con l'app authenticator), ognuno rimovibile singolarmente.

**Note tecniche:** interamente basata sull'MFA nativo di Supabase Auth (TOTP) --- nessuna crypto custom. Riguarda solo il layer di identità/login: non tocca mai la master key né la cifratura del vault, che restano protette solo dalla master password, del tutto separate (v. HINTHIAL_MVP.md, sezione 4). `signIn()` reindirizza a `/login/mfa` invece che alla dashboard quando la sessione è solo `aal1` e può salire ad `aal2`; lo stesso controllo vive anche in `(app)/layout.tsx`, per un URL diretto raggiunto senza passare dal login. Un codice non dichiara per quale dispositivo è stato generato: viene provato su ogni fattore registrato finché uno lo accetta. Richiede TOTP abilitato sul progetto Supabase (`supabase/config.toml`, `[auth.mfa.totp]`).

### Impostazioni > Privacy: "Cosa sa Hinthial di te"

**Cosa fa:** nuova scheda che mette a confronto, con dati reali e attuali dell'account (non un testo generico), cosa il server vede in chiaro --- email, conteggi per sezione, categorie, disposizione del menu --- con cosa non vedrà mai: nomi dei file, contenuti, contatti fiduciari, capsule, master password. Pensata per chi vuole verificare di persona la promessa zero-knowledge, non solo leggerla dichiarata.

**Note tecniche:** ogni query legge solo colonne mai cifrate (conteggi, `status`/`is_friend` di trusted_contacts, `status` delle capsule, la tassonomia delle categorie), quindi non serve la master key sbloccata.

### Impostazioni > Attività: registro degli eventi dell'account

**Cosa fa:** nuova scheda che mostra il registro tecnico già scritto ad ogni login/logout, contenuto aggiunto o eliminato, contatto fiduciario aggiunto, vault svuotato --- raggruppato per giorno (Oggi/Ieri/data) e filtrabile per categoria. Mai nomi di file o di contatti, solo il tipo di evento: restano privati anche qui.

**Note tecniche:** log puramente tecnico e in chiaro (v. `lib/audit/log-event.ts`), non serve la master key.

### Kit di recovery stampabile con QR

**Cosa fa:** alla creazione della master password, una terza opzione ("Stampa kit di recovery") accanto a copia/download .txt: un foglio pensato per essere stampato e conservato fisicamente, con la recovery key in grande e un QR code --- comodo per reinserirla su un dispositivo nuovo senza ricopiare a mano una chiave a 384 bit.

**Note tecniche:** il QR è generato interamente lato client (libreria `qrcode`); la chiave non lascia mai il browser, nessuna chiamata di rete. Il foglio stampabile vive fuori vista nel DOM e diventa visibile solo nella finestra di stampa (pattern CSS "stampa solo questo elemento", v. `lib/print.ts`).

### Modifica di una capsula: stessi tre passi della creazione

**Cosa fa:** la pagina di modifica di una capsula è ora organizzata negli stessi tre passi della creazione (chi e quando -> contenuti dall'archivio -> audio, video e testo), invece di un unico form con tutti i campi insieme --- stessa intestazione "Passo X di 3" e gli stessi pulsanti Avanti/Indietro.

**Note tecniche:** `EditCapsuleForm` riusa `STEP_LABEL` e la stessa struttura a passi di `CreateCapsuleForm`; nessun cambiamento ai dati salvati o a `updateCapsule`.

### Onboarding: nascondibile dalla barra, e una pagina dedicata in Impostazioni

**Cosa fa:** il pannello che si apre dall'indicatore "Onboarding" nella barra di navigazione ha ora un pulsante "Nascondi", che lo fa sparire dalla barra da quel momento in poi (su questo dispositivo). L'avanzamento resta comunque consultabile in una nuova voce "Onboarding" tra le schede di Impostazioni: una percentuale in grande con un messaggio accanto (di apprezzamento quando l'onboarding è avanti, di incoraggiamento quando è indietro), e sotto la lista di tutte le attività con una breve descrizione e lo stato ("✅ Fatto" o un pulsante "Da fare" che porta dove completarla). Da lì è anche possibile far ricomparire l'indicatore nella barra.

**Note tecniche:** la preferenza "nascosto" vive solo in localStorage (come il tema), non sul server. Condivisa tra l'indicatore nella barra e la nuova pagina di Impostazioni tramite un nuovo `OnboardingWidgetVisibilityProvider` (Context React) --- necessario perché la barra di navigazione resta montata attraversando le pagine dell'app: senza uno stato condiviso, nasconderla da Impostazioni non si sarebbe riflesso lì finché non si fosse ricaricata la pagina per intero. `OnboardingStep` (in `domain/onboarding/steps.ts`) guadagna un campo `description`, riusato sia qui sia potenzialmente altrove, per restare l'unica fonte dei passi.

### Rifiniture: logo e colore dell'indicatore Onboarding

**Cosa fa:** il logo nella barra orizzontale dopo il login è ora della stessa dimensione di quello nella home page pubblica. L'anello dell'indicatore "Onboarding" diventa verde quando l'avanzamento raggiunge il 100% (prima restava sempre del colore del brand).

### Disposizione del menu di navigazione

**Cosa fa:** in Impostazioni > Aspetto è ora possibile scegliere come disporre il menu di navigazione: barra laterale a sinistra (come finora), barra laterale a destra, oppure barra orizzontale in alto. La scelta si applica subito a tutta l'app e resta impostata su tutti i dispositivi dell'utente, esattamente come la visualizzazione delle liste. Nella barra orizzontale il logo mostra anche il nome (non solo l'icona), le voci di navigazione mostrano l'etichetta accanto all'icona (non solo l'icona), e il campo di ricerca è per esteso, non compresso.

**Note tecniche:** nuova colonna `profiles.nav_orientation` (`sidebar-left` di default, `sidebar-right`, `topbar`), letta lato server in `getCurrentUser()` e passata come prop iniziale ad `AppShell` --- a differenza della visualizzazione delle liste, qui il valore dev'essere noto *prima* del primo render per evitare un lampo del layout sbagliato, dato che decide la struttura dell'intera shell, non un dettaglio interno a una sezione. `AppShell` sceglie tra `Sidebar` (a sinistra o a destra, riordinata via classi `md:order-*`, non riordinando il markup: su mobile il menu resta sempre in cima) e il nuovo `TopNav`. `MainNav` guadagna una variante orizzontale (icone soltanto, come la barra laterale compressa) e `UserMenu` un verso di apertura del popover verso il basso, allineato a destra, per quando vive in cima allo schermo invece che in fondo a una barra laterale. Corretto anche un effetto collaterale: il popover dell'indicatore "Onboarding" si apriva sempre verso destra, uscendo dallo schermo quando la barra laterale sta a destra --- ora si ancora al bordo opposto se non c'è spazio.

### Onboarding, home page pubblica e rifiniture

**Cosa fa:** l'indicatore nella barra laterale si chiama ora "Onboarding" (era "Primi passi"). La nuvola dei passi non depenna più le voci completate (restano scritte normalmente) e non parla più di passi "opzionali": tutti gli 8 passi contano allo stesso modo verso la percentuale mostrata. Il passo "Imposta una scadenza" è stato rimosso, essendo un'attività passiva rispetto al contribuire contenuti. In Impostazioni > Aspetto > Visualizzazione delle liste, "Contatti fiduciari" è stato rinominato in "Contatti". Il carosello della home page pubblica ora avanza da solo ogni 6 secondi (in pausa al passaggio del mouse, disattivato con `prefers-reduced-motion`), e sotto di esso la pagina è stata ampliata in stile brochure responsive: una sezione "Perché Hinthial" con i punti di forza (zero-knowledge, archivio unico, assistente locale, capsule, personalizzazione, sviluppo incrementale) e una sezione "Come funziona" in tre passi.

**Note tecniche:** `domain/onboarding/steps.ts` non ha più il concetto di passo opzionale; la percentuale è ora calcolata su tutti gli 8 passi. Individuato e corretto un bug nel carosello: il mouse resta fermo sopra il componente dopo un click (come farebbe un utente reale), quindi una pausa-al-focus in più lo avrebbe bloccato per sempre --- risolto tenendo solo la pausa al passaggio del mouse (`onMouseEnter`/`onMouseLeave`), senza equivalenti per la tastiera.

### Dead Man's Switch semplificato per le capsule (fase 1 di 3)

**Cosa fa:** ogni capsula richiede ora una data di apertura obbligatoria (prima era facoltativa) --- raggiunta quella data, il destinatario potrà vederne il contenuto. Ogni utente deve avere almeno un contatto fiduciario marcato come "amico" (nuova azione nel menu di un contatto, badge "🤝 Amico"): è un prerequisito reale, diventato un passo obbligatorio nell'onboarding ("Aggiungi un amico"). In modifica di una capsula è ora possibile anche gestire gli allegati audio/video: rimuovere quelli esistenti e registrarne/caricarne di nuovi, esattamente come in creazione.

**Note tecniche:** `capsules.open_at` è diventata una colonna in chiaro (era solo dentro il payload cifrato) --- unica eccezione consapevole allo zero-knowledge in questa tabella, necessaria perché in una fase successiva il server possa sapere *quando* una capsula è pronta senza dover decifrare nulla. Le capsule create prima della migrazione si "sanano" da sole (il valore torna in chiaro) la prima volta che il proprietario le rivede. `trusted_contacts.is_friend` è un nuovo flag, indipendente da `status`. Questa è solo la prima di tre sotto-fasi pianificate: mancano ancora la soglia di inattività con promemoria via email (Resend) e, soprattutto, lo scambio di chiavi che permetterà a un destinatario di decifrare davvero una capsula (richiede che ogni "amico" diventi un utente Hinthial con una propria coppia di chiavi).

### Dashboard: contatori e indicatore di avanzamento

**Cosa fa:** i contatori per sezione in dashboard sono ora centrati, con un'icona più grande. Il contatore "Contatti" mostra due conteggi distinti sotto al totale: quanti sono attivi e, separatamente, quanti sono amici. Nuovo indicatore "Primi passi" sempre visibile nella barra laterale (non solo in dashboard): una grafica a torta con la percentuale di completamento dei passi obbligatori, che al click apre la lista di cosa è stato fatto e cosa manca.

**Note tecniche:** la logica dei passi di onboarding è stata estratta in `domain/onboarding/steps.ts`, condivisa tra la card in dashboard e il nuovo indicatore nella barra laterale, per evitare due liste che potessero disallinearsi.

### Home page pubblica

**Cosa fa:** la pagina che si vede visitando Hinthial da sconnessi ha ora una barra in alto (logo a sinistra, Accedi/Registrati o "Vai alla dashboard" a destra) e un corpo da vera landing page, con un carosello di 5 schermate che spiega cosa fa Hinthial (cifratura zero-knowledge, archivio multi-tipo, asset e scadenze, capsule, assistente AI locale).

### Documentazione

- Allineata la "Roadmap sintetica" di `HINTHIAL_MVP.md` alle fasi già scritte in dettaglio (mancava la FASE 14, ed erano segnate come due fasi separate "AI real" e "Proactive AI" che invece la spec descrive come un'unica FASE 11).
- Aggiunto questo changelog.

---

## 2026-09-04

Un ampio arretrato di funzionalità, sviluppate nel corso di più sessioni precedenti e registrate su git in questa data (v. nota sulle date in cima al file). In ordine di dipendenza (non di importanza):

### Suggerimento automatico della categoria
**Cosa fa:** caricando un contenuto in Archivio, un nome file con parole chiave riconoscibili (es. "polizza-assicurazione-auto.pdf") riceve una categoria suggerita in automatico --- resta comunque una scelta correggibile a mano.

### Ordinamento delle tabelle
**Cosa fa:** in ogni sezione (Archivio, Scadenze, Asset, Contatti, Capsule, Cronologia), passando alla vista a tabella, si può ordinare cliccando l'intestazione di una colonna --- un secondo click inverte la direzione. Le tabelle partono già ordinate per la prima colonna, dalla A alla Z.

### Liste: vista a tabella impaginata, ricerca/filtro, azioni a menu
**Cosa fa:** ogni sezione principale può essere vista come elenco o come tabella (impostabile in Impostazioni > Aspetto, o con l'interruttore rapido nella sezione stessa); le liste lunghe in tabella sono impaginate; ogni sezione ha una ricerca e un filtro in alto; le azioni su una riga (modifica, elimina, ...) sono raccolte in un menu "⋮" invece di pulsanti sparsi.

### Assistente AI locale (FASE 10)
**Cosa fa:** una sezione "AI" dove si possono fare domande sui propri contenuti ("quali assicurazioni ho?", "quando scade la mia assicurazione auto?") e ricevere risposte con citazione delle fonti, più suggerimenti proattivi (scadenze in arrivo o scadute, asset senza documenti collegati). Tutto elaborato sul dispositivo, nessun contenuto lascia mai il browser.

**Note tecniche:** interfaccia `AIProvider` pensata per essere sostituita in futuro da un provider reale, mantenendo esplicito il vincolo di privacy (elaborazione locale, o esplicitamente autorizzata verso un provider esterno) --- v. `domain/ai/mock-provider.ts`.

### Ricerca globale
**Cosa fa:** una ricerca (richiamabile da tastiera) che trova qualunque cosa --- asset, documenti, scadenze, contatti, capsule --- e porta dritti al risultato scelto.

### Cronologia
**Cosa fa:** una vista di sola lettura su asset e documenti aggiunti nel tempo, raggruppati per mese.

### Tema chiaro/scuro/sistema
**Cosa fa:** in Impostazioni > Aspetto si può scegliere tema chiaro, scuro, o "segui il sistema" --- la scelta resta impostata anche dopo un refresh.

### Avatar utente
**Cosa fa:** si può caricare una propria immagine del profilo, ritagliata a quadrato prima del caricamento; senza immagine, iniziali su uno sfondo colorato.

### Registrazione audio/video per le capsule, countdown
**Cosa fa:** creando una capsula, si può registrare un messaggio audio o video direttamente nel browser (oltre a caricarne uno già pronto); se la capsula ha una data di apertura, un countdown testuale ("si aprirà tra N giorni") la accompagna in lista.

### Esporta le scadenze come file .ics
**Cosa fa:** le scadenze si possono scaricare in un file .ics, importabile in qualunque calendario.

### FASE 14 --- Archivio multi-tipo e capsule autosufficienti
**Cosa fa:** "Documenti" è diventato "Archivio" e accetta più tipi di contenuto oltre ai file: immagini, audio, video e note testuali scritte direttamente nell'app --- tutti con gli stessi attributi (categoria, asset collegato, scadenza, tag, note) e un player inline per chi ha senso. La creazione di una capsula è un percorso guidato a tre passi (chi e quando, contenuti dall'Archivio da collegare, audio/video/testo). Chiudere una capsula ora ne fa una copia autosufficiente: da quel momento non dipende più dai contenuti originali in Archivio, che restano liberi di essere modificati o cancellati.

### Trascrizione locale (infrastruttura) e anteprima capsula
**Cosa fa:** un contenuto audio/video in Archivio (o allegato a una capsula) può avere una trascrizione testuale, cercabile come il resto --- oggi va scritta a mano: il motore di trascrizione automatica in-browser non esiste ancora (onestamente segnalato in interfaccia), ma l'infrastruttura è pronta per quando ci sarà. Una capsula si può vedere in anteprima esattamente come la vedrà chi la riceve.

### "Cancella tutto" (zona pericolosa)
**Cosa fa:** in Impostazioni > Zona pericolosa, un'azione (con conferma esplicita, serve scrivere "ELIMINA TUTTO") che svuota Archivio, Asset, Contatti e Capsule, e ripristina le categorie predefinite --- le Scadenze non vengono toccate, restano solo scollegate da ciò che è stato cancellato.

### Dashboard a due colonne
**Cosa fa:** la dashboard è organizzata in due colonne (la prima più larga): a sinistra i contatori per sezione, le prossime scadenze, gli elementi aggiunti di recente e da completare; a destra la guida "Primi passi con Hinthial" e "Da tenere d'occhio" (suggerimenti e salute del vault uniti in un'unica sezione).

### Importa/Esporta spostato in Impostazioni
**Cosa fa:** non più una sezione a sé nel menu principale, ma una scheda di Impostazioni.

### Sidebar comprimibile
**Cosa fa:** la barra laterale si può comprimere a sole icone (tasto dedicato), per avere più spazio; la scelta resta impostata su quel dispositivo dopo un refresh.

### Pagine di modifica dedicate
**Cosa fa:** modificare un elemento di Archivio, Asset, Contatti o Capsule ora apre una pagina a sé (come già succedeva per la creazione), invece di un form inline nella riga della lista.

---

## 2026-09-01

### FASE 6-9 --- Asset, Contatti fiduciari, Capsule, Export
**Cosa fa:** censimento di beni e contratti (Asset) con collegamento a documenti e scadenze; contatti fiduciari con stato (in attesa/attivo/revocato); prima versione delle capsule digitali (titolo, contenuto, allegati, destinatari); esportazione di tutti i propri dati in un unico archivio .zip; importazione di contatti e asset da file CSV.

---

## 2026-08-26 --- 2026-08-28

Le fondamenta del progetto (FASE 0-5):

- **FASE 0-1**: bootstrap del progetto e shell dell'app (navigazione, autenticazione).
- **FASE 2**: autenticazione e database (Supabase Auth, Postgres, Row Level Security).
- **FASE 3**: le fondamenta crittografiche --- Master Key non estraibile, gerarchia di chiavi per documento, tutto costruito solo su Web Crypto API (nessun algoritmo scritto a mano).
- **FASE 4**: il primo vault documentale --- caricamento, cifratura, download e cancellazione di un documento.
- **FASE 5**: metadati (categoria, asset collegato, scadenza, tag, note) e prima versione delle scadenze.
- Rifiniture di marchio e interfaccia: logo ufficiale, colori di brand, pagina di verifica email, indicatore di robustezza della password, recovery key allungata a 384 bit.

---

## Come continuare questo file

Ogni volta che una nuova modifica viene completata e verificata, aggiungere una voce in cima (subito sotto l'ultima data, o in una nuova sezione datata se è un giorno diverso), con lo stesso schema "Cosa fa" / "Note tecniche".

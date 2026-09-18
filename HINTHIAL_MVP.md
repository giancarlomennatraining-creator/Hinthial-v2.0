# HINTHIAL --- MVP DEVELOPMENT SPEC

## 1. Obiettivo

HINTHIAL è un Personal Life OS per organizzare, proteggere e rendere
utilizzabili nel tempo le informazioni importanti della vita di una
persona.

La prima versione deve essere **funzionante, semplice e realmente
utilizzabile**, senza cercare di implementare subito tutto il progetto
futuro.

Principio guida:

> Metti ordine nella tua vita digitale, proteggi ciò che conta e rendi
> le informazioni importanti accessibili alle persone giuste quando
> serve.

Il prodotto deve essere presentato prima di tutto come uno strumento
quotidiano. La componente di digital legacy sarà costruita
progressivamente.

Il progetto di riferimento comprende anche HINTHIAL AI: un livello
intelligente capace, in prospettiva, di comprendere le informazioni
autorizzate dell'utente, collegarle e rispondere tramite chat, oltre a
proporre azioni e scenari futuri.

------------------------------------------------------------------------

## 2. Obiettivo tecnico della prima release

Costruire una **web application responsive**, installabile e pronta a
essere estesa successivamente a mobile/desktop.

La prima release deve permettere di:

1.  creare un account;
2.  effettuare login/logout;
3.  creare una master password locale;
4.  generare e mostrare una recovery key;
5.  salvare documenti nel vault;
6.  cifrare i contenuti prima dell'invio al server;
7.  organizzare i documenti per categoria;
8.  aggiungere metadati e scadenze;
9.  visualizzare uno scadenzario;
10. collegare documenti tra loro tramite semplici relazioni;
11. esportare i propri dati;
12. configurare almeno un contatto fiduciario;
13. avere una prima struttura per le capsule digitali;
14. avere una chat HINTHIAL AI inizialmente limitata/mockata, ma
    progettata con un'interfaccia che possa essere sostituita da un
    motore AI reale in una fase successiva.

**Non implementare ancora** successioni, testamenti, trasferimenti di
denaro, servizi finanziari, firma notarile, gestione patrimoniale o Dead
Man's Switch completo.

------------------------------------------------------------------------

## 3. Stack tecnologico

### Frontend

-   **Next.js + React + TypeScript**
-   App Router
-   Tailwind CSS
-   componenti UI accessibili e semplici
-   PWA/responsive design

Next.js è adatto a una prima web application full-stack e l'App Router è
il router moderno documentato dal framework.

### Backend / Database

-   **Supabase**
-   PostgreSQL
-   Supabase Auth
-   Row Level Security
-   Supabase Storage solo per blob già cifrati lato client
-   Edge Functions solo quando realmente necessarie

Supabase fornisce PostgreSQL, Auth, Storage e policy RLS integrate. Il
database deve contenere esclusivamente dati applicativi e metadati
strettamente necessari; il contenuto sensibile deve arrivare già
cifrato.

### Crittografia

La crittografia deve essere eseguita **nel client**, prima di qualsiasi
upload.

Usare una libreria crittografica consolidata dove possibile. La Web
Crypto API può fornire primitive browser-native, ma non deve essere
considerata sufficiente da sola per progettare una sicurezza
production-grade: il key management e il protocollo complessivo devono
essere progettati e successivamente sottoposti a revisione
specialistica.

Obiettivi:

-   encryption client-side;
-   chiave derivata dalla master password;
-   recovery key separata;
-   chiavi per documento/file;
-   nessuna master password sul server;
-   nessun plaintext dei documenti sul server;
-   HTTPS obbligatorio;
-   zero-knowledge come obiettivo architetturale.

**Non inventare algoritmi crittografici. Non scrivere primitive crypto
custom.**

### Storage

File:

`Client -> encrypt -> upload -> encrypted storage`

Mai:

`Client -> upload plaintext -> server -> encrypt`

Il server deve vedere al massimo metadati tecnici minimi, ad esempio:

-   user id;
-   document id;
-   dimensione;
-   tipo tecnico generico;
-   timestamp;
-   ciphertext;
-   versione dello schema.

Evitare di memorizzare plaintext di titoli, note o contenuti sensibili
se non indispensabile.

### Testing

-   Vitest per unit test
-   Playwright per end-to-end
-   ESLint
-   TypeScript strict mode

Ogni funzione importante deve avere almeno un test.

------------------------------------------------------------------------

## 4. Principio architetturale fondamentale

Separare chiaramente:

### Identity layer

Gestisce:

-   account;
-   sessione;
-   autenticazione;
-   autorizzazione.

### Encryption layer

Gestisce:

-   master key;
-   recovery key;
-   encryption/decryption;
-   key wrapping;
-   gestione delle chiavi in memoria.

### Data layer

Gestisce:

-   documenti;
-   categorie;
-   scadenze;
-   asset;
-   contatti;
-   capsule;
-   relazioni.

### AI layer

Gestisce:

-   ricerca;
-   retrieval;
-   comprensione;
-   chat;
-   suggerimenti;
-   scenari.

L'AI deve essere un modulo sostituibile e non deve essere intrecciata
direttamente con il database.

------------------------------------------------------------------------

## 5. Modello dati iniziale

Creare un modello semplice, estendibile.

Entità principali:

### UserProfile

-   id
-   display_name
-   created_at
-   updated_at

### Document

-   id
-   owner_id
-   encrypted_payload
-   encrypted_filename
-   mime_type
-   size
-   category_id
-   created_at
-   updated_at
-   expires_at
-   version

### Category

-   id
-   owner_id
-   name
-   icon
-   created_at

Categorie iniziali:

-   Personale
-   Casa
-   Veicoli
-   Assicurazioni
-   Contratti
-   Fiscale
-   Salute
-   Finanze
-   Account
-   Altro

### Relation

Collega due elementi HINTHIAL.

Esempio:

`Polizza auto -> Veicolo`

oppure:

`Contratto -> Immobile`

Per l'MVP può collegare principalmente documenti e asset.

### Asset

Rappresenta un elemento della vita dell'utente:

-   immobile
-   veicolo
-   account
-   bene
-   contratto
-   assicurazione
-   altro

Payload sensibile cifrato.

### Reminder

-   id
-   owner_id
-   encrypted_title/payload
-   due_at
-   related_entity_id
-   completed
-   created_at

### TrustedContact

-   id
-   owner_id
-   encrypted_name
-   encrypted_email
-   role
-   status
-   created_at

### Capsule

-   id
-   owner_id
-   encrypted_payload
-   status
-   access_condition
-   created_at

Nella prima versione una capsula può essere semplicemente un contenitore
cifrato con un destinatario e uno stato.

### AuditEvent

Registrare eventi tecnici non sensibili:

-   login
-   logout
-   document_created
-   document_updated
-   document_deleted
-   export_started
-   trusted_contact_added

Non registrare nei log contenuti, password, chiavi o plaintext.

------------------------------------------------------------------------

# 6. Piano di sviluppo a fasi

Ogni fase deve produrre una funzione piccola e verificabile.

## FASE 0 --- Bootstrap

Creare il progetto.

Deliverable:

-   repository Git;
-   Next.js;
-   TypeScript strict;
-   Tailwind;
-   ESLint;
-   Vitest;
-   Playwright;
-   struttura cartelle;
-   `.env.example`;
-   README;
-   CI di base.

Non sviluppare funzionalità di prodotto in questa fase.

------------------------------------------------------------------------

## FASE 1 --- Shell dell'app

Creare:

-   landing minimale;
-   login;
-   registrazione;
-   dashboard vuota;
-   navigazione principale.

Navigazione:

-   Dashboard
-   Vault
-   Scadenze
-   Asset
-   Contatti
-   Capsule
-   AI
-   Impostazioni

Deliverable: un utente può registrarsi, autenticarsi e vedere la
dashboard.

------------------------------------------------------------------------

## FASE 2 --- Supabase Auth + database

Implementare:

-   Supabase Auth;
-   profilo utente;
-   schema PostgreSQL;
-   migrations;
-   RLS;
-   gestione sessione;
-   logout.

Regola:

> ogni record appartenente a un utente deve essere accessibile
> esclusivamente a quell'utente.

Scrivere test RLS.

------------------------------------------------------------------------

## FASE 3 --- Crypto foundation

Questa è una fase critica.

Implementare un piccolo modulo isolato:

`crypto/`

Responsabilità:

-   generazione master key;
-   derivazione della chiave dalla master password;
-   generazione recovery key;
-   encryption/decryption;
-   key wrapping;
-   serializzazione sicura;
-   gestione della memoria delle chiavi.

Non implementare ancora sharing complesso.

Creare test automatici per:

-   encrypt/decrypt;
-   password errata;
-   recovery;
-   dati corrotti;
-   file grandi;
-   versioning del formato.

Documentare chiaramente il protocollo.

**Prima di considerare questa parte production-ready, prevedere security
review professionale.**

------------------------------------------------------------------------

## FASE 4 --- Vault documentale

Implementare:

-   upload file;
-   cifratura client-side;
-   upload ciphertext;
-   lista documenti;
-   categorie;
-   apertura/decrittazione;
-   eliminazione;
-   download/export.

Il server non deve mai ricevere il file originale in plaintext.

La UI deve far percepire il vault come un archivio semplice e
quotidiano.

------------------------------------------------------------------------

## FASE 5 --- Metadata e scadenze

Aggiungere:

-   data di scadenza;
-   note cifrate;
-   categoria;
-   tag;
-   relazione con asset;
-   reminder.

Dashboard:

-   prossime scadenze;
-   documenti recenti;
-   elementi da completare.

------------------------------------------------------------------------

## FASE 6 --- Asset e relazioni

Implementare un modello semplice di inventario.

Esempio:

`Casa -> Assicurazione -> Contratto -> Documento`

L'obiettivo non è creare subito un knowledge graph complesso.

Deve essere possibile:

-   creare un asset;
-   collegare documenti;
-   collegare scadenze;
-   visualizzare le relazioni.

Questa struttura sarà fondamentale per HINTHIAL AI.

------------------------------------------------------------------------

## FASE 7 --- Contatto fiduciario

Implementare:

-   aggiunta contatto;
-   ruolo;
-   stato invito;
-   revoca;
-   UI di gestione.

In questa fase NON implementare ancora lo sblocco automatico dei dati.

Il contatto fiduciario è inizialmente una struttura dati e un elemento
di autorizzazione futura.

------------------------------------------------------------------------

## FASE 8 --- Capsule digitali v1

Implementare una prima capsula molto semplice:

-   titolo;
-   contenuto;
-   allegati;
-   destinatario;
-   condizione;
-   stato.

Tutto il contenuto deve essere cifrato.

Per l'MVP la condizione può essere manuale, ad esempio:

`Bozza -> Pronta -> Condivisa`

Non implementare ancora Dead Man's Switch completo.

------------------------------------------------------------------------

## FASE 9 --- Export e recovery

L'utente deve poter esportare i propri dati.

Implementare:

-   export metadata;
-   export documenti cifrati;
-   export configurazione;
-   recovery workflow;
-   verifica recovery key.

L'export deve essere documentato e comprensibile.

Principio:

> HINTHIAL non deve diventare una prigione dei dati dell'utente.

------------------------------------------------------------------------

# 7. FASE 10 --- HINTHIAL AI v0

Prima di collegare un modello AI reale, creare l'architettura.

Interfaccia:

`AIProvider`

con funzioni concettuali:

-   `search()`
-   `retrieve()`
-   `answer()`
-   `suggest()`

Creare inizialmente un provider mock.

Esempio:

Utente:

> "Quali assicurazioni ho?"

Sistema:

1.  recupera gli asset assicurativi autorizzati;
2.  recupera i documenti collegati;
3.  costruisce il contesto;
4.  restituisce una risposta.

L'AI deve poter ragionare sulle **relazioni** tra entità, non soltanto
cercare parole nei documenti.

------------------------------------------------------------------------

# 8. HINTHIAL AI --- vincolo privacy

Il requisito zero-knowledge entra in conflitto con il semplice utilizzo
di un LLM cloud che riceva il plaintext.

Quindi NON implementare automaticamente:

`Database -> OpenAI/Claude -> risposta`

senza definire prima il modello di privacy.

L'architettura deve supportare almeno due modalità future:

### Local/private AI

Il contenuto viene decrittato nel client e analizzato localmente da un
modello compatibile.

### Explicit AI processing

L'utente autorizza esplicitamente l'elaborazione di determinati
contenuti da parte di un provider AI esterno.

Il provider deve ricevere esclusivamente il minimo contesto necessario.

Questa scelta deve essere resa esplicita nella UI.

Per l'MVP è sufficiente costruire l'interfaccia `AIProvider`, il
retrieval locale e un provider mock.

------------------------------------------------------------------------

# 9. FASE 11 --- AI reale

Solo dopo che vault, relazioni e crypto funzionano.

Implementare progressivamente:

### Chat

Domande come:

-   "Quali assicurazioni ho?"
-   "Quando scade la mia assicurazione auto?"
-   "Quali documenti riguardano la casa?"
-   "Quali contratti scadono nei prossimi 60 giorni?"

### Context engine

Creare un contesto strutturato:

`User -> Assets -> Documents -> Relations -> Reminders -> Contacts`

### Retrieval

Partire da ricerca strutturata e full-text.

Aggiungere embeddings/vector search solo quando realmente necessario.

### Proactive AI

Successivamente:

-   rilevamento informazioni mancanti;
-   scadenze a rischio;
-   incongruenze;
-   possibili azioni;
-   scenari futuri.

Esempio:

> "Hai una polizza auto collegata al veicolo X che scade tra 28 giorni.
> Non trovo un rinnovo associato. Vuoi che crei un promemoria?"

Questo è il primo esempio del comportamento propositivo di HINTHIAL AI.

------------------------------------------------------------------------

# 10. FASE 12 --- Dead Man's Switch

Solo dopo avere stabilizzato identità, autorizzazioni, contatti e
capsule.

Implementare progressivamente:

1.  inactivity detection;
2.  notifiche;
3.  grace period;
4.  contatti di controllo;
5.  verifica formale;
6.  final waiting period;
7.  eventuale apertura capsule.

Non utilizzare un singolo timer.

Ogni transizione deve essere auditabile.

Questa funzionalità richiede successivamente revisione legale e security
review.

------------------------------------------------------------------------

# 11. FASE 13 --- Dispositivi fidati e sblocco multi-dispositivo

Solo dopo avere stabilizzato capsule e Dead Man's Switch (FASE 12).

Oggi la Master Key esiste solo in memoria sul dispositivo che l'ha
sbloccata con la master password o la recovery key --- ogni nuovo
dispositivo deve reinserirla da capo. Questa fase introduce un secondo
modo di sbloccarla: un dispositivo già fidato che ne autorizza uno
nuovo, senza che il server veda mai la chiave in chiaro.

Implementare progressivamente:

1.  registrazione di un dispositivo fidato --- richiede comunque la
    master password o la recovery key almeno una volta: non c'è modo
    di aggirarlo, è la prima immissione del segreto;
2.  blocco locale della chiave sul dispositivo fidato, protetto da
    autenticazione biometrica della piattaforma (WebAuthn/passkey), mai
    conservata in chiaro;
3.  pairing tra dispositivi: il dispositivo nuovo genera una coppia di
    chiavi effimera e la mostra come QR code; il dispositivo fidato la
    scansiona, l'utente approva, e cifra la Master Key per quella
    chiave effimera --- il server fa solo da tramite cieco;
4.  elenco e revoca dei dispositivi fidati (Impostazioni).

Decisione architetturale da sciogliere prima di iniziare: oggi la
Master Key viene creata non-extractable (v. PROTOCOL.md) --- per essere
trasmessa a un altro dispositivo deve poter essere esportata almeno
temporaneamente, il che indebolisce quella garanzia. Va deciso
consapevolmente come e quando concederlo.

Non usare notifiche push native per l'approvazione: introducono
frammentazione importante tra iOS e Android (su iOS funzionano solo per
un sito installato come PWA). L'approvazione tramite QR code aperto
manualmente nel browser copre tutti i sistemi in modo uniforme.

Revocare un dispositivo dal server impedisce che approvi altri
dispositivi in futuro, ma non cancella la chiave che aveva già in
locale --- va previsto anche un modo per "dimenticare" un dispositivo
dal dispositivo stesso.

Ogni registrazione, approvazione e revoca deve essere auditabile.

Questa funzionalità introduce per la prima volta un trasferimento di
chiave device-to-device nel modello zero-knowledge --- richiede
revisione di sicurezza dedicata prima di andare in produzione, allo
stesso titolo del Dead Man's Switch.

------------------------------------------------------------------------

# 12. FASE 14 --- Archivio multi-tipo e capsule autosufficienti

Rinomina "Documenti" in "Archivio" e ne estende il modello a più tipi di
contenuto (documento, immagine, audio, video, nota testuale) con
attributi invariati (categoria, asset collegato, scadenza, tag, note) a
prescindere dal tipo. Allinea la schermata allo stesso pattern già usato
da scadenze/asset/contatti/capsule (pagina di creazione dedicata, filtro
in alto, tasto "+ Aggiungi contenuto"). Ridisegna la creazione di una
capsula come wizard a due passi e cambia cosa significa "chiudere" una
capsula: da riferimento bloccato a copia autosufficiente.

Implementare progressivamente:

1.  rinomina "Documenti" -> "Archivio" nella UI (nomi di file/cartelle/
    route restano in inglese, per la convenzione del progetto);
2.  nota testuale come nuovo tipo di contenuto: stessa tabella/
    cifratura dei documenti, il testo digitato è il contenuto cifrato
    al posto di un file caricato --- nessun nuovo schema;
3.  pagina di creazione dedicata (`/archive/new` o simile) con scelta
    del tipo: carica un file, registra audio/video, scrivi una nota;
4.  pannello lista semplificato: lista + ricerca/filtro in alto (già
    pronti) + "+ Aggiungi contenuto" al posto del pannello inline
    espandibile attuale;
5.  player inline per audio/video/immagini nella lista, con "Scarica"
    sempre disponibile a fianco;
6.  generalizzare `DocumentAttachmentPicker` da "solo documenti" a
    "qualunque tipo dall'Archivio";
7.  creazione capsula come wizard a due passi: passo 1 (titolo, data
    di apertura, destinatari), passo 2 (contenuto dall'Archivio via il
    picker generalizzato, più registrazione/caricamento diretto di
    audio/video che restano privati della capsula --- mai copiati in
    Archivio, pensati come messaggio personale per quel destinatario);
8.  chiudere una capsula (bozza -> chiusa) diventa una copia vera: ogni
    contenuto d'Archivio referenziato viene decifrato e ricifrato con
    una chiave propria della capsula, salvato nel suo storage --- da
    quel momento la capsula non dipende più dall'originale;
9.  di conseguenza, il blocco "documento non cancellabile perché dentro
    una capsula chiusa" non serve più e va rimosso: l'originale torna
    libero non appena la copia è fatta;
10. gestire il fallimento a metà chiusura con lo stesso pattern di
    rollback già usato in `createCapsule` per gli allegati.

Conseguenza accettata consapevolmente: chiudere una capsula con più
contenuti richiede più tempo (decifra e ricifra ognuno, non è più solo
un cambio di stato), e per un po' esistono due copie cifrate della
stessa cosa --- l'originale in Archivio e la copia nella capsula ---
finché una delle due non viene eliminata.

------------------------------------------------------------------------

# 13. FASI 17-26 --- HINTHIAL AI: dalla lettura locale all'assistente che agisce

Estensione concreta di quanto la FASE 11 lascia abbozzato ("Proactive
AI", "Retrieval"): portare HINTHIAL da un assistente che *risponde* a
uno che **legge i contenuti, ne estrae fatti, propone oggetti e aiuta a
tenere in ordine archivio e vita**.

Numerate dalla 17 perché 15 (security/legal hardening) e 16 (production
release) sono già assegnate nella roadmap sintetica --- coerente con la
scala di priorità del documento, che mette "intelligente" per ultimo.

Il piano è diviso in tre blocchi, con una sola regola che li ordina:
**tutto ciò che si può fare senza far uscire nulla dal dispositivo viene
prima.**

------------------------------------------------------------------------

## Blocco A --- valore senza rischio (FASI 17-21)

Nessun contenuto lascia il dispositivo, nessun consenso nuovo da
chiedere. Da solo copre gran parte del valore percepito: archivio che si
nomina e cataloga da sé, scadenze che nascono dai documenti, ricerca
dentro i file, spese sommate per anno.

### FASE 17 --- Lettura locale dei contenuti

Estrarre testo dai contenuti già in Archivio, tutto in-browser: PDF (via
pdf.js) e immagini (OCR). Il testo estratto si cifra con la Master Key
come ogni altro campo.

*Stato: **chiusa.*** PDF nativi (17a), ricerca che spiega i risultati e
recupero dei contenuti storici (17b), OCR delle immagini (17c) e dei PDF
scansionati (17d), scheda del contenuto con "cosa ho letto" (17e).

**La trascrizione audio/video è stata spostata nel blocco B** (v. FASE
22b), e non è un rinvio per stanchezza: è l'unico pezzo di "lettura
locale" che la tecnologia locale non sa ancora fare bene. Un modello
vocale in-browser pesa 40-75 MB contro i 5,6 MB dell'OCR, su un telefono
è spesso più lento del tempo reale, e in italiano sbaglia abbastanza da
rendere la trascrizione un danno invece di un aiuto: a differenza
dell'OCR, un modello vocale produce frasi plausibili anche quando ha
capito male, e il filtro anti-spazzatura che protegge l'OCR (v.
`ocr-extractor.ts`) lì non è replicabile. Costo massimo, resa minima
(gli audio sono una frazione dei contenuti di un archivio personale) e
qualità insufficiente: tre motivi concordi. Nel frattempo il
comportamento resta onesto --- la scheda dichiara "non so ancora
ascoltare gli audio" e la trascrizione si scrive a mano, con la ricerca
che la usa.

La scheda introdotta in 17e è anche il **pavimento delle fasi
successive**: i campi estratti (18), le proposte (19), il fascicolo (20)
e il consenso per singolo contenuto (22) atterrano tutti lì. È il motivo
per cui è stata costruita prima della 18 e non dopo: senza, la 18
estrarrebbe campi che nessuna schermata è in grado di mostrare.

Effetto immediato e verificabile: la ricerca globale smette di cercare
tra i nomi dei file e cerca **dentro**; la categorizzazione euristica
(`domain/categorizer`), che oggi vede solo il nome, diventa attendibile.

### FASE 18 --- Estrazione strutturata locale

Dal testo estratto ai campi: data del documento, scadenze dichiarate
("ricontrollo tra 6 mesi"), importi, emittente. Sono schemi, non
ragionamento: nessun modello coinvolto. Alimenta le prime proposte
(rinomina, data corretta, scadenza).

### FASE 19 --- Meccanismo delle proposte

Non porta funzioni visibili: porta la **fiducia**, e va costruita prima
di qualunque scrittura automatica. Un oggetto "proposta" con cosa, la
fonte da cui nasce, e accetta/modifica/rifiuta; memoria dei rifiuti (non
ripropone ciò che hai già scartato); annullamento; ogni azione tracciata
in Attività con tipi di evento propri.

Vincolo architetturale da rispettare: **il server può proporre, solo il
client può scrivere** --- gli oggetti vanno cifrati con la Master Key,
che il server non possiede.

*Stato: **fatta.*** Proposte su scadenza e categoria nella scheda di un
contenuto, con accetta/modifica/rifiuta, fonte mostrata accanto a ogni
proposta, memoria dei rifiuti cifrata (`proposal_rejections`),
annullamento e tre nuovi tipi di evento in Attività.

Il vincolo è rispettato in modo **strutturale** e non per disciplina: le
proposte si calcolano nel browser dal testo già decifrato (v.
`domain/proposals/build.ts`, funzione pura) e il server non le vede mai
nascere. Il valore *rifiutato* è cifrato con la Master Key: un valore
accettato finisce comunque in chiaro in `documents.expires_at`, ma uno
rifiutato non esisterebbe da nessuna parte sul server, e salvarlo in
chiaro introdurrebbe un dato che senza questa fase non ci sarebbe.

**19b --- le proposte al momento del caricamento.** La 19, da sola, era
mezza consegnata: aveva costruito il meccanismo e l'aveva messo nel posto
meno frequentato dell'app, una scheda che si apre solo andandola a
cercare. Chi carica venti documenti senza aprirne nessuno non vedrebbe
mai una proposta. Ora il file viene letto **appena lo scegli** (non al
salvataggio: così la lettura avviene mentre compili il resto) e il form
si precompila da solo --- titolo, categoria, bene collegato, scadenza.

Due regole imparate qui:

- **In creazione si precompila, sulla scheda si chiede.** Non è
  incoerenza: in creazione non c'è ancora niente dell'utente da
  sovrascrivere, e vedere il valore in un form che si sta già rivedendo
  *è* il consenso.
- **Tranne il titolo, che si propone.** È l'unico campo che arriva già
  compilato --- il nome del file --- e vale anche lì la regola "non si
  tocca ciò che è già compilato". Un titolo sbagliato messo in silenzio
  cambierebbe l'identità del documento senza che nessuno se ne accorga.

Proponibili oggi solo i due campi che hanno una casa dove essere scritti
(`expires_at`, `category_id`). Data del documento, importo ed emittente
(FASE 18) restano visibili ma non proponibili: inventare una colonna per
avere una proposta in più sarebbe il contrario del lavorare per fasi ---
troveranno posto quando un oggetto vero le richiederà (v. FASE 20-21).

### FASE 20 --- Fascicoli

Nuovo oggetto **trasversale alle categorie**, per le vicende che si
sviluppano nel tempo (un problema di salute, l'acquisto di una casa, un
incidente): cronologia invece di elenco, stato aperto/chiuso, totale
delle spese, condivisione in blocco. Creazione manuale in questa fase.

Non richiede IA: è una struttura che manca già oggi. Categoria = un
cassetto; fascicolo = una storia che attraversa più cassetti. È anche
l'unità naturale da lasciare in una capsula.

### FASE 21 --- Import massivo e riconoscimento di insiemi

Caricamento di molti file in una volta con riepilogo **per gruppi**
invece di una conferma per file; rilevamento di serie ricorrenti (lo
stesso valore misurato nel tempo); proposta di fascicoli dai
raggruppamenti evidenti; totali di spesa per anno e categoria.

Limite deliberato: mostrare andamenti e numeri, **mai interpretarli**.
Un valore fuori range si segnala solo se è il documento stesso a dirlo.

------------------------------------------------------------------------

## Blocco B --- l'IA reale (FASI 22-24)

Da qui cambia la postura di privacy: ogni passo va consentito
esplicitamente. Dipende dalla FASE 15 (security/legal hardening): mandare
documenti personali a un fornitore terzo richiede DPA, privacy policy
aggiornata e una decisione esplicita sui dati particolari.

### FASE 22 --- Analisi dei contenuti con Claude

**Unica fase irreversibile del piano:** un contenuto uscito è uscito.

Consenso granulare su tre assi --- funzione (rispondere / leggere
contenuti / avvisare) x ambito (categoria) x singolo contenuto --- con
possibilità di permessi a scadenza ("solo questo", "per 30 giorni"), di
escludere un singolo file anche dentro una categoria abilitata, e di
vedere in Attività cosa è uscito, quando e perché.

Salute dietro interruttore separato; diagnosi con consenso ulteriore. Il
principio: escludere l'**invio**, non l'intelligenza --- date, scadenze e
richiami sanitari si ricavano già in locale dalle FASI 17-18.

L'analisi produce output strutturato che rientra nel meccanismo della
FASE 19, mai scritture dirette.

### FASE 22b --- Trascrizione audio/video

Arrivava dalla FASE 17, dove era l'unico pezzo che la tecnologia locale
non sa ancora fare abbastanza bene (v. FASE 17 per il ragionamento
completo). Qui trova il suo posto naturale: un modello di qualità vera,
dietro lo stesso consenso esplicito e la stessa tracciabilità in Attività
di ogni altro invio. Sostituisce lo stub in `domain/transcription`, che
oggi restituisce sempre `null`.

Vincolo che resta dalla FASE 17: una trascrizione sbagliata è peggio di
nessuna trascrizione, perché riempie la ricerca di parole mai dette.
Serve la stessa soglia di fiducia applicata all'OCR --- e va deciso, una
volta per tutte, se il testo trascritto sia correggibile a mano come oggi
o in sola lettura come il testo estratto (v. FASE 17e).

### FASE 23 --- Chat con memoria e azioni

Conversazioni persistite e cifrate (quindi rimandate dal client a ogni
richiesta: il server non può leggerle). La chat smette di produrre solo
testo e comincia a produrre proposte. Ricorda cosa ha già proposto e
cosa è stato rifiutato.

### FASE 24 --- Avvisi proattivi

La sezione che **deve poter restare vuota** --- ed è vuota quasi sempre.
Sostituisce concettualmente "Da tenere d'occhio", rimossa dalla
Dashboard proprio perché costruita su regole che contano sempre
qualcosa, e quindi parlava sempre.

Vincolo strutturale: il cron gira sul server, che non può leggere nulla.
Quindi o l'analisi gira sul dispositivo all'apertura dell'app, oppure
richiede il consenso della FASE 22. Non esiste una terza via.

------------------------------------------------------------------------

## Blocco C --- fonti esterne (FASI 25-26)

Il problema numero uno di un archivio è ricordarsi di riempirlo. Queste
due fasi lo risolvono, ma vanno per ultime.

### FASE 25 --- Google Drive

Scope ristretto ai soli file scelti dall'utente. L'import è una **copia
cifrata dentro Hinthial, non un collegamento**: un contenuto che resta
fuori dal vault vanificherebbe la promessa. Rilevamento dei duplicati
(lo stesso documento arrivato da più strade).

### FASE 26 --- Gmail

Per ultima non per difficoltà tecnica: leggere la posta richiede uno
scope "restricted" di Google, con verifica e **audit di sicurezza
annuale a pagamento** per un'app pubblica --- una decisione di budget
prima che di codice (da riverificare sulla documentazione aggiornata).

Il controllo gira **sul dispositivo all'apertura dell'app**, non su un
cron lato server: un server che legge la posta vedrebbe i contenuti in
chiaro, ed è il primo pezzo di Hinthial che lo farebbe. Nemmeno i soli
metadati sono una via di mezzo accettabile --- sapere che scrive un
oncologo è già un'informazione clinica.

Serve inoltre una lista di mittenti che contano, appresa dai sì e dai no
dell'utente: una proposta per ogni allegato PDF renderebbe la funzione
insopportabile in due giorni.

------------------------------------------------------------------------

# 14. UI / UX

L'app deve comunicare ordine, sicurezza e semplicità.

Evitare come elemento principale:

-   morte;
-   eredità;
-   successione;
-   testamento.

Usare invece:

-   La tua vita digitale
-   Documenti
-   Scadenze
-   Beni
-   Informazioni importanti
-   Persone di fiducia
-   Capsule
-   Assistente AI

Onboarding target:

**meno di 3 minuti.**

Prima esperienza:

1.  crea account;
2.  configura sicurezza;
3.  aggiungi primo documento;
4.  assegna categoria;
5.  opzionalmente imposta una scadenza.

L'utente deve vedere valore immediatamente.

------------------------------------------------------------------------

# 15. Cosa NON costruire nella prima versione

Non implementare:

-   gestione di denaro;
-   pagamenti;
-   investimenti;
-   successioni;
-   testamento legale;
-   firma notarile;
-   custodia crypto;
-   integrazione bancaria;
-   integrazione sanitaria;
-   Dead Man's Switch completo;
-   condivisione complessa multi-party;
-   AI autonoma che prende decisioni;
-   automazioni irreversibili.

L'obiettivo è costruire una base solida, non un prodotto completo.

------------------------------------------------------------------------

# 16. Struttura repository suggerita

``` text
src/
  app/
    (auth)/
    dashboard/
    vault/
    reminders/
    assets/
    contacts/
    capsules/
    ai/
    settings/

  components/
    ui/
    layout/
    vault/
    dashboard/

  lib/
    auth/
    crypto/
    db/
    storage/
    audit/
    ai/

  domain/
    documents/
    assets/
    reminders/
    contacts/
    capsules/

  types/

tests/
  unit/
  e2e/

supabase/
  migrations/
  seed/
```

Separare sempre:

-   UI
-   domain logic
-   persistence
-   crypto
-   AI

------------------------------------------------------------------------

# 17. Regole per Claude Code

Claude Code deve lavorare **una fase alla volta**.

Per ogni fase:

1.  leggere il README e il codice esistente;
2.  comprendere l'architettura;
3.  implementare solo la fase richiesta;
4.  non anticipare funzionalità future;
5.  scrivere test;
6.  eseguire lint;
7.  eseguire typecheck;
8.  eseguire test;
9.  verificare il comportamento;
10. aggiornare README/documentazione;
11. indicare cosa è stato completato;
12. indicare eventuali rischi o decisioni aperte.

Non riscrivere parti funzionanti senza motivo.

Non introdurre dipendenze inutili.

Non usare dati sensibili reali nei test.

Non inserire segreti nel repository.

Non considerare la crittografia "production ready" senza security
review.

Quando esiste un dubbio architetturale importante, fermarsi e proporre
le alternative invece di prendere una decisione irreversibile.

------------------------------------------------------------------------

# 18. Definition of Done

Una fase è completata quando:

-   la funzione è utilizzabile dalla UI;
-   il codice è tipizzato;
-   i test principali passano;
-   non ci sono errori lint;
-   non ci sono errori TypeScript;
-   la documentazione è aggiornata;
-   non vengono introdotte violazioni del modello privacy;
-   il comportamento è verificabile localmente.

------------------------------------------------------------------------

# 19. Roadmap sintetica

``` text
0  Bootstrap
1  App shell
2  Auth + DB + RLS
3  Crypto foundation
4  Secure Vault
5  Metadata + deadlines
6  Assets + relations
7  Trusted contacts
8  Capsules v1
9  Export + recovery
10 AI architecture + mock
11 AI real + retrieval + proactive AI
12 Dead Man's Switch
13 Dispositivi fidati e sblocco multi-dispositivo
14 Archivio multi-tipo e capsule autosufficienti
15 Security/legal hardening
16 Production release

   HINTHIAL AI --- blocco A: niente esce dal dispositivo
17 Lettura locale dei contenuti (PDF + OCR) --- chiusa
18 Estrazione strutturata locale (date, importi, emittente)
19 Meccanismo delle proposte (accetta/modifica/rifiuta + Attività)
20 Fascicoli (vicende trasversali alle categorie)
21 Import massivo e riconoscimento di insiemi

   HINTHIAL AI --- blocco B: l'IA reale (dipende da 15)
22  Analisi dei contenuti con Claude --- unica fase irreversibile
22b Trascrizione audio/video (arrivava dalla 17)
23 Chat con memoria e azioni
24 Avvisi proattivi (possono restare vuoti)

   HINTHIAL AI --- blocco C: fonti esterne
25 Google Drive (import = copia cifrata, non collegamento)
26 Gmail (scope restricted: decisione di budget)
```

La priorità è:

**funzionante → sicuro → semplice → estendibile → intelligente**

Non il contrario.

------------------------------------------------------------------------

## 20. Stato iniziale del progetto

Partire dalla **FASE 0**.

Prima di scrivere codice:

1.  creare il repository;
2.  creare il progetto Next.js;
3.  configurare TypeScript strict;
4.  configurare lint/test;
5.  creare `.env.example`;
6.  creare README;
7.  verificare che `dev`, `build`, `lint` e `test` funzionino.

Poi fermarsi.

Le fasi successive devono essere implementate singolarmente e verificate
prima di procedere.

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

# 12. UI / UX

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

# 13. Cosa NON costruire nella prima versione

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

# 14. Struttura repository suggerita

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

# 15. Regole per Claude Code

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

# 16. Definition of Done

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

# 17. Roadmap sintetica

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
11 AI real + retrieval
12 Proactive AI
13 Dead Man's Switch
14 Dispositivi fidati e sblocco multi-dispositivo
15 Security/legal hardening
16 Production release
```

La priorità è:

**funzionante → sicuro → semplice → estendibile → intelligente**

Non il contrario.

------------------------------------------------------------------------

## 18. Stato iniziale del progetto

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

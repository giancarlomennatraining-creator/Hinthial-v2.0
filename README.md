# HINTHIAL

Personal Life OS per organizzare, proteggere e rendere utilizzabili nel
tempo le informazioni importanti della vita di una persona.

> Metti ordine nella tua vita digitale, proteggi ciò che conta e rendi le
> informazioni importanti accessibili alle persone giuste quando serve.

Lo sviluppo segue la spec di prodotto/tecnica in
[HINTHIAL_MVP.md](./HINTHIAL_MVP.md), procedendo **una fase alla volta**
(vedi sezione 6 e 16 della spec per il piano completo).

## Stato del progetto

**FASE 0 --- Bootstrap**, **FASE 1 --- Shell dell'app**,
**FASE 2 --- Supabase Auth + database**, **FASE 3 --- Crypto foundation**,
**FASE 4 --- Vault documentale**, **FASE 5 --- Metadata e scadenze**,
**FASE 6 --- Asset e relazioni**, **FASE 7 --- Contatto fiduciario** e
**FASE 8 --- Capsule digitali v1** completate.

La FASE 2 sostituisce l'autenticazione mockata della FASE 1 con
**Supabase Auth reale**: registrazione, login, logout, gestione sessione
(cookie via `@supabase/ssr`, con refresh automatico in `src/proxy.ts`) e
un profilo utente persistito in PostgreSQL. Le route autenticate
(`src/app/(app)/`) sono protette da un unico layout server-side
(`src/app/(app)/layout.tsx`) che reindirizza a `/login` in assenza di
sessione valida. Ogni login/logout viene registrato in `audit_events`
(nessun contenuto sensibile, solo l'evento). **Row Level Security** è
attiva su tutte le tabelle e verificata da un test di integrazione
dedicato (vedi sotto).

La FASE 3 introduce il modulo di cifratura client-side isolato
(`src/lib/crypto/`, protocollo documentato in
[`src/lib/crypto/PROTOCOL.md`](./src/lib/crypto/PROTOCOL.md)): master
key, chiave derivata dalla master password (PBKDF2), recovery key
(HKDF), chiavi per documento, tutto su AES-256-GCM via Web Crypto API.
Al momento della FASE 3 il modulo non era ancora collegato a nessuna UI:
era isolato e testato in autonomia (66 test). **Non ancora
production-ready senza revisione di sicurezza professionale** resta
vero (vedi il protocollo per i punti aperti).

La FASE 4 collega finalmente tutto in **Documenti**
(`/documents`, `src/app/(app)/documents/`): al primo accesso l'utente
crea una **master password** (diversa dalla password dell'account) che
genera la Master Key e mostra una **recovery key** una sola volta
(`src/components/crypto/`); da quel momento la Master Key resta solo in
memoria lato client per la sessione (persa a un refresh completo, per
design --- va risbloccata). Upload: il file viene cifrato nel browser
(contenuto sotto una Document Key dedicata, nome file sotto la Master
Key) prima di lasciare il dispositivo; il ciphertext del contenuto va su
**Supabase Storage** (bucket privato, RLS per-utente), i metadati
tecnici e le chiavi cifrate su Postgres (`documents`, `categories`,
`encryption_setup`). Apertura/download decrittano nel browser;
l'eliminazione rimuove sia la riga sia il blob. Le 10 categorie
iniziali (sezione 5 della spec) sono seedate automaticamente alla
registrazione.

**Rifiniture successive**: la registrazione mostra ora un indicatore di
robustezza della password in tempo reale, con la lista dei criteri
soddisfatti man mano che si digita (`src/lib/auth/password-strength.ts`,
non blocca l'invio oltre al minimo di 8 caratteri già richiesto --- è
solo un aiuto visivo). Il link di conferma email ora atterra su una
pagina dedicata (`/verify-account`) con un pulsante verso il login,
invece che sull'endpoint di verifica ospitato da Supabase (richiede
configurazione manuale nel Dashboard, vedi sezione Setup).

La FASE 5 aggiunge a **Documenti**: scadenza opzionale, note cifrate e
tag cifrati (un pulsante "+ dettagli" li rivela in fase di upload;
ogni documento è anche modificabile in seguito tramite "Modifica" ---
mai il file o il nome, solo categoria/scadenza/note/tag). Nuova
sezione **Scadenze** (`/reminders`): promemoria con titolo cifrato,
data, stato completato/non completato, collegabili opzionalmente a un
documento. La **Dashboard** mostra ora 3 widget (prossime scadenze,
documenti recenti, elementi da completare/scaduti) quando la
cifratura è sbloccata; il saluto resta visibile comunque, con un
prompt a sbloccare/configurare se serve --- e segnala anche se la
cifratura è già stata configurata (master password creata e recovery
key salvata).

La FASE 6 introduce l'entità **Asset** (`/assets`): un inventario
semplice (nome cifrato, categoria opzionale) a cui collegare documenti
e scadenze --- generalizzando il legame reminder→documento della FASE
5, non sostituendolo. Ogni asset mostra i documenti e le scadenze
collegati; eliminarlo li scollega (non li cancella). Le **categorie**
(`categories`, seedate alla registrazione) sono ora un'entità gestibile
dall'utente --- creazione, modifica, eliminazione da **Impostazioni**
(`/settings`, raggiungibile dal menu utente) --- non più solo la
tassonomia fissa iniziale.

**Rifiniture successive**: recupero password via codice OTP via email
(`/forgot-password`), con lo stesso indicatore di robustezza della
registrazione al passo finale di reimpostazione. **Impostazioni**
(`/settings`) è ora organizzata a schede: "Informazioni utente" (nome/
cognome, salvati su `profiles`; email, gestita separatamente tramite
`supabase.auth.updateUser()` --- richiede conferma, non cambia subito)
e "Categorie" (invariata).

La FASE 7 introduce il **Contatto fiduciario** (`/contacts`,
`trusted_contacts`): nome ed email cifrati con la Master Key, ruolo
libero (es. "Coniuge"), stato (`pending` → `active`/`revoked`) gestito
manualmente. Per esplicita indicazione della spec, questa fase **non**
implementa alcuno sblocco automatico dei dati --- è solo la struttura
dati e la UI di gestione, propedeutiche a un'autorizzazione futura.

La FASE 8 introduce le **Capsule** (`/capsules`, `capsules`): titolo,
contenuto e allegati (a numero libero, ciascuno con una propria
Document Key come i documenti in FASE 4) vivono insieme in un unico
`encrypted_payload` cifrato con la Master Key --- coerente con
l'entità Capsule di sezione 5, un solo campo cifrato invece di uno per
campo. Destinatario opzionale collegato a un contatto fiduciario
(FASE 7). Stato manuale **Bozza → Pronta → Condivisa**; niente
editing dopo la creazione in v1 (solo cambi di stato ed eliminazione).
"Condividi" resta solo un cambio di stato registrato: **niente Dead
Man's Switch** in questa fase, per esplicita indicazione della spec.

## Stack

- **Frontend**: Next.js (App Router) + React + TypeScript (strict) + Tailwind CSS
- **Backend/DB**: Supabase (PostgreSQL, Auth, Row Level Security, Storage) --- tutto collegato dalla FASE 4
- **Crittografia**: Web Crypto API nativa (AES-256-GCM, PBKDF2, HKDF), nessuna libreria/primitiva custom --- modulo da FASE 3, integrato nella UI da FASE 4
- **Test**: Vitest (unit) + Playwright (e2e)
- **Lint/Type checking**: ESLint + TypeScript strict mode

## Struttura del repository

Nomi di file/cartelle/URL in inglese (coerente col resto del codice);
l'italiano resta solo per ciò che l'utente vede --- label di
navigazione, testi, messaggi.

```text
src/
  app/            # route Next.js (App Router)
    (auth)/         # login, register, forgot-password(/verify,/new),
                     # check-email, verify-account --- nessuna sessione richiesta
    (app)/          # dashboard, documents, reminders, assets, contacts,
                     # capsules, ai, settings --- layout condiviso che
                     # richiede una sessione Supabase valida
    auth/confirm/   # Route Handler per il link di conferma email
  components/     # componenti UI, per feature (a specchio di domain/)
    ui/             # TextField, PasswordStrengthMeter, PlaceholderSection, ...
    layout/         # AppShell, MainNav, UserMenu, nav-items
    crypto/         # sessione Master Key: provider, form di setup/sblocco (FASE 4)
    documents/      # pannello lista/upload/apri/elimina/modifica (FASE 4-5)
    reminders/      # pannello scadenze: crea/completa/elimina (FASE 5)
    assets/         # pannello asset: crea/modifica/elimina, relazioni (FASE 6)
    contacts/       # pannello contatti fiduciari: crea/attiva/revoca/elimina (FASE 7)
    capsules/       # pannello capsule: crea (con allegati), avanza stato, elimina (FASE 8)
    settings/       # schede Informazioni utente + Categorie
    dashboard/      # saluto + stato cifratura + 3 widget (FASE 5)
  lib/            # infrastruttura generica, non legata a una singola feature
    auth/           # Server Actions (signUp/signIn/signOut/reset password), current-user
    db/supabase/    # client Supabase (browser/server/middleware)
    crypto/         # modulo di cifratura isolato (FASE 3) + PROTOCOL.md
    storage/        # bucket Storage per i payload cifrati (documenti FASE 4, allegati capsule FASE 8)
    audit/          # log-event.ts --- eventi tecnici non sensibili
    ai/             # FASE 10+
  domain/         # tipi + repository per entità, un fetch/CRUD alla volta
    documents/      # upload/apri/elimina/modifica, note/tag/scadenza cifrati
    reminders/      # crea/completa/elimina
    assets/         # crea/modifica/elimina (FASE 6)
    categories/     # crea/modifica/elimina --- in chiaro, non richiede la Master Key
    contacts/       # crea/attiva/revoca/elimina, nessuno sblocco dati (FASE 7)
    capsules/       # crea (payload unico cifrato + allegati), avanza stato, elimina (FASE 8)
    profile/        # nome/cognome (Impostazioni --- Informazioni utente)
  types/          # tipi condivisi (incl. supabase.ts, schema del DB)
  proxy.ts        # refresh della sessione Supabase su ogni richiesta

tests/
  unit/
    crypto/         # test del modulo di cifratura (FASE 3)
    rls.integration.test.ts  # RLS su DB reale
  e2e/
    documents.spec.ts    # setup master key, upload, apertura, eliminazione (FASE 4)
    reminders.spec.ts    # reminder, metadati documento, widget dashboard (FASE 5)
    assets.spec.ts        # asset, relazioni con documenti/scadenze (FASE 6)
    categories.spec.ts    # CRUD categorie, avviso in caso di uso, selettore icone
    contacts.spec.ts      # contatto fiduciario, stato pending/active/revoked (FASE 7)
    capsules.spec.ts      # capsula con destinatario/allegato, stato bozza/pronta/condivisa (FASE 8)
    password-reset.spec.ts  # recupero password via OTP
    user-info.spec.ts     # schede Impostazioni, modifica nome/cognome/email

supabase/
  migrations/     # migration SQL, applicate con `supabase db push`
  seed/           # dati di seed per sviluppo/test
```

Principio architetturale: separare sempre **UI**, **domain logic**,
**persistence**, **crypto** e **AI** (vedi sezione 4 della spec).

## Requisiti

- Node.js 24+ (LTS) --- versioni precedenti (es. 20) hanno un'incompatibilità
  nota tra `jsdom` e `undici` (`webidl.util.markAsUncloneable is not a
  function`) che fa fallire i test unitari
- npm

## Setup

```bash
npm install
cp .env.example .env.local
```

1. Crea un progetto su [supabase.com/dashboard](https://supabase.com/dashboard) (piano Free va bene).
2. Compila `.env.local` con `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   e `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API).
3. Applica le migration al database:
   ```bash
   npx supabase db push --db-url "<connection string da Project Settings → Database>"
   ```
4. **"Confirm email"** (Authentication → Sign In / Providers → Email):
   disattivato è più comodo per lo sviluppo (login/registrazione
   funzionano subito). Se invece la attivi, per far funzionare la
   pagina "Account verificato" (`/auth/confirm`, vedi sotto) devi anche:
   - **Authentication → URL Configuration → Site URL** = l'URL della tua
     app (es. `http://localhost:3000` in sviluppo);
   - **Authentication → Emails → Templates → Confirm signup**: sostituisci
     il link nel template con
     `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup`
     (il link di default punta all'endpoint `/verify` ospitato da
     Supabase, che non imposta il cookie di sessione nel modo giusto per
     questo setup SSR).
5. **Recupero password** (`/forgot-password`, flusso a codice OTP,
   non a link): in **Authentication → Emails → Templates → Reset
   Password**, personalizza il template per mostrare il codice invece
   del solo link, es. aggiungendo
   `<p>Il tuo codice di verifica è: <strong>{{ .Token }}</strong></p>`.
   `{{ .Token }}` è il codice a 6 cifre che l'utente inserisce nella
   pagina di verifica; il template di default non lo mostra.
6. **Consigliato**: configura un provider SMTP personalizzato (es.
   [Resend](https://resend.com), gratuito) in **Authentication → SMTP Settings**.
   Il mailer condiviso di Supabase è limitato a **2 email/ora**, un limite che si
   esaurisce quasi subito durante lo sviluppo/test; con SMTP personalizzato sale
   a 30/ora. Nota: un sender Resend non verificato può consegnare solo
   all'indirizzo email del proprietario dell'account Resend --- per verificare
   il flusso di registrazione reale con altri destinatari serve un dominio
   verificato su Resend.

Il modulo `supabase/` usa la Supabase CLI (`npx supabase ...`) solo per
applicare le migration al database remoto: non richiede Docker (a differenza
di `supabase start`, lo stack locale completo, non usato qui).

## Comandi

```bash
npm run dev         # avvia il server di sviluppo (http://localhost:3000)
npm run build        # build di produzione
npm run start         # avvia la build di produzione
npm run lint          # ESLint
npm run typecheck     # genera i tipi delle route Next.js + TypeScript in modalità --noEmit
npm run test           # unit test (Vitest), incl. il test di integrazione RLS se .env.local è configurato
npm run test:watch     # unit test in watch mode
npm run test:e2e        # end-to-end test (Playwright; esegue build + start automaticamente)
npm run dev:https       # come npm run dev, ma su HTTPS --- serve per aprire l'app da altri
                        # dispositivi sulla stessa rete locale (es. per testare da smartphone):
                        # Web Crypto (crypto.subtle, usato per la Master Key) richiede un
                        # "secure context", che il browser concede solo a localhost oppure a
                        # HTTPS --- un IP di LAN in HTTP semplice non basta. Richiede un
                        # certificato locale generato una volta con mkcert (non incluso nel
                        # repo, vedi certificates/ --- gitignored): `mkcert -install` installa
                        # la CA locale sul PC, poi
                        # `mkcert -key-file certificates/localhost-key.pem -cert-file certificates/localhost.pem localhost 127.0.0.1 ::1 <IP-LAN-del-PC>`.
                        # Sul dispositivo che apre il sito da un altro device, il browser
                        # segnalerà il certificato come non affidabile (normale, è
                        # autofirmato): procedi comunque ("Avanzate" -> "Visita il sito") ---
                        # la connessione resta comunque HTTPS, quindi crypto.subtle funziona.
```

Il test e2e di registrazione (`la registrazione crea un account`) usa
l'indirizzo email opzionale `E2E_REGISTRATION_TEST_EMAIL` (vedi
`.env.example`); se non configurato viene saltato automaticamente.

**`npm run reset-dev-data`** --- solo sviluppo: elimina tutti gli utenti
(a cascata: profili, categorie, documenti, configurazione di cifratura)
e svuota il bucket Storage, lasciando intatti schema e migration. Utile
per ripartire da zero durante i test manuali. Richiede
`SUPABASE_SERVICE_ROLE_KEY` in `.env.local`. **Mai** su un progetto con
dati reali.

## Sicurezza e privacy --- principi guida

- La cifratura dei contenuti avviene **lato client**, prima di qualsiasi
  upload. Il server non deve mai ricevere plaintext dei documenti né la
  master password.
- Nessuna primitiva crittografica custom: solo Web Crypto API nativa
  (AES-256-GCM, PBKDF2, HKDF). Protocollo completo in
  [`src/lib/crypto/PROTOCOL.md`](./src/lib/crypto/PROTOCOL.md), incluso
  l'elenco esplicito di ciò che manca prima di essere production-ready
  (richiede una revisione di sicurezza dedicata).
- Row Level Security su ogni tabella (incl. `storage.objects`, per-utente
  via il primo segmento del path) --- ogni record/file è accessibile
  solo al proprietario, verificato da
  `tests/unit/rls.integration.test.ts` contro un database reale (due
  utenti usa-e-getta, mai dati reali).
- Il database contiene solo metadati tecnici minimi indispensabili
  (mime type, dimensione, categoria, timestamp); nome file e contenuto
  sono sempre inviati già cifrati.
- La Master Key esiste solo cifrata sul server (`encryption_setup`,
  wrappata da password e da recovery key); in chiaro vive solo in
  memoria lato client, per la durata della sessione.
- La `SUPABASE_SERVICE_ROLE_KEY` non è mai usata dall'app: esiste solo
  nei test, per creare/eliminare utenti di prova via API admin.

Vedi [HINTHIAL_MVP.md](./HINTHIAL_MVP.md) sezione 3 per i dettagli.

## Cosa NON è ancora implementato

Coerentemente con il piano a fasi, in questa release non sono presenti:
export, AI. Le pagine di queste sezioni esistono solo come placeholder
navigabili, protette da autenticazione reale ma senza logica di
prodotto. Il contatto fiduciario (FASE 7) e le capsule (FASE 8) sono
solo struttura dati e gestione dello stato --- nessuno sblocco
automatico dei dati né Dead Man's Switch, per esplicita indicazione
della spec. Documenti resta minimale: niente rinomina/sostituzione del
file caricato; le capsule non sono modificabili dopo la creazione
(solo cambio di stato ed eliminazione). Vedi sezione 12 della spec per
l'elenco completo di ciò che non va costruito nella prima versione del
prodotto.

## Come contribuire (per Claude Code / agenti)

Vedi sezione 14 della spec ("Regole per Claude Code"): una fase alla
volta, con lint, typecheck e test verdi prima di considerarla completa.

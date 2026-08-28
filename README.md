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
**FASE 2 --- Supabase Auth + database**, **FASE 3 --- Crypto foundation**
e **FASE 4 --- Vault documentale** completate.

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
(`/documenti`, `src/app/(app)/documenti/`): al primo accesso l'utente
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

## Stack

- **Frontend**: Next.js (App Router) + React + TypeScript (strict) + Tailwind CSS
- **Backend/DB**: Supabase (PostgreSQL, Auth, Row Level Security, Storage) --- tutto collegato dalla FASE 4
- **Crittografia**: Web Crypto API nativa (AES-256-GCM, PBKDF2, HKDF), nessuna libreria/primitiva custom --- modulo da FASE 3, integrato nella UI da FASE 4
- **Test**: Vitest (unit) + Playwright (e2e)
- **Lint/Type checking**: ESLint + TypeScript strict mode

## Struttura del repository

```text
src/
  app/            # route Next.js (App Router)
    (auth)/         # login, registrazione --- nessuna sessione richiesta
    (app)/          # dashboard, documenti, reminders, assets, contacts,
                     # capsules, ai, settings --- layout condiviso che
                     # richiede una sessione Supabase valida
  components/     # componenti UI
    ui/
    layout/
    crypto/         # sessione Master Key: provider, form di setup/sblocco (FASE 4)
    documenti/      # pannello lista/upload/apri/elimina (FASE 4)
    dashboard/
  lib/            # infrastruttura
    auth/           # Server Actions (signUp/signIn/signOut), current-user
    db/supabase/    # client Supabase (browser/server/middleware)
    crypto/         # modulo di cifratura isolato (FASE 3) + PROTOCOL.md
    storage/        # bucket Storage per i payload cifrati (FASE 4)
    audit/          # log-event.ts --- eventi tecnici non sensibili
    ai/             # FASE 10+
  domain/
    documents/      # tipi + repository (FASE 4): categorie, upload/apri/elimina
  types/          # tipi condivisi (incl. supabase.ts, schema del DB)
  proxy.ts        # refresh della sessione Supabase su ogni richiesta

tests/
  unit/
    crypto/         # test del modulo di cifratura (FASE 3)
    rls.integration.test.ts  # RLS su DB reale
  e2e/
    documenti.spec.ts  # setup master key, upload, apertura, eliminazione (FASE 4)

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
4. In **Authentication → Sign In / Providers → Email**, disattiva **"Confirm email"**
   (consigliato per lo sviluppo: login/registrazione funzionano subito, senza
   dover confermare un indirizzo email ogni volta).
5. **Consigliato**: configura un provider SMTP personalizzato (es.
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
```

Il test e2e di registrazione (`la registrazione crea un account`) usa
l'indirizzo email opzionale `E2E_REGISTRATION_TEST_EMAIL` (vedi
`.env.example`); se non configurato viene saltato automaticamente.

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
scadenze, asset, contatti fiduciari, capsule, export, AI. Le pagine di
queste sezioni esistono solo come placeholder navigabili, protette da
autenticazione reale ma senza logica di prodotto. Documenti (FASE 4) è
implementato ma minimale: niente rinomina/modifica, niente gestione
categorie oltre alle 10 di default, niente relazioni con asset (FASE 6).
Vedi sezione 12 della spec per l'elenco completo di ciò che non va
costruito nella prima versione del prodotto.

## Come contribuire (per Claude Code / agenti)

Vedi sezione 14 della spec ("Regole per Claude Code"): una fase alla
volta, con lint, typecheck e test verdi prima di considerarla completa.

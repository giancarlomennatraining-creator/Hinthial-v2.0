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

> Nota: questa sezione descrive lo stato del progetto fino alla FASE 8. Il codice è proseguito molto oltre (OCR,
> import Google Drive, eredità digitale, MFA, device lock, fascicoli, tag, e altro): per lo stato attuale vedi
> [CHANGELOG.md](./CHANGELOG.md) (più recente in cima) e [HINTHIAL_MVP.md](./HINTHIAL_MVP.md).

FASE 2: **Supabase Auth reale** (registrazione, login, logout, sessione via cookie con refresh in `src/proxy.ts`),
route autenticate protette da un unico layout server-side, login/logout in `audit_events`, **Row Level Security**
su tutte le tabelle.

FASE 3: modulo di cifratura client-side isolato (`src/lib/crypto/`, protocollo in
[`src/lib/crypto/PROTOCOL.md`](./src/lib/crypto/PROTOCOL.md)) --- master key, PBKDF2, recovery key via HKDF, chiavi
per documento, tutto AES-256-GCM via Web Crypto API. Non ancora collegato a UI in questa fase (66 test isolati).
**Non ancora production-ready senza revisione di sicurezza professionale.**

FASE 4: **Documenti** (`/documents`) --- master password al primo accesso, recovery key mostrata una sola volta,
Master Key solo in memoria per la sessione. Upload cifrato nel browser (Document Key per il contenuto, Master Key
per il nome file) prima di lasciare il dispositivo; ciphertext su **Supabase Storage**, metadati e chiavi cifrate
su Postgres. Le 10 categorie iniziali sono seedate alla registrazione.

Rifiniture: indicatore di robustezza password in tempo reale (`src/lib/auth/password-strength.ts`); il link di
conferma email atterra su `/verify-account` invece dell'endpoint Supabase.

FASE 5: **Documenti** guadagna scadenza opzionale, note e tag cifrati. Nuova sezione **Scadenze** (`/reminders`).
La **Dashboard** mostra 3 widget quando la cifratura è sbloccata.

Rifiniture: recupero password via OTP (`/forgot-password`); **Impostazioni** a schede.

FASE 6: entità **Asset** (`/assets`), a cui collegare documenti e scadenze. Le **categorie** diventano gestibili
dall'utente da Impostazioni.

FASE 7: **Contatto fiduciario** (`/contacts`) --- nome/email cifrati, stato `pending`/`active`/`revoked` gestito
manualmente. Nessuno sblocco automatico dei dati in questa fase.

FASE 8: **Capsule** (`/capsules`) --- titolo, contenuto e allegati in un unico `encrypted_payload`. Destinatario
opzionale collegato a un contatto fiduciario. Stato manuale Bozza → Pronta → Condivisa, niente editing dopo la
creazione, niente Dead Man's Switch in questa fase.

## Stack

- **Frontend**: Next.js (App Router) + React + TypeScript (strict) + Tailwind CSS
- **Backend/DB**: Supabase (PostgreSQL, Auth, Row Level Security, Storage) --- tutto collegato dalla FASE 4
- **Crittografia**: Web Crypto API nativa (AES-256-GCM, PBKDF2, HKDF), nessuna libreria/primitiva custom --- modulo da FASE 3, integrato nella UI da FASE 4
- **Test**: Vitest (unit) + Playwright (e2e)
- **Lint/Type checking**: ESLint + TypeScript strict mode

## Struttura del repository

Nomi di file/cartelle/URL in inglese; l'italiano resta solo per ciò che l'utente vede.

> Nota: l'elenco sotto riflette la struttura fino alla FASE 8. Molte altre directory sono state aggiunte da allora
> (digital-legacy, google-drive, extraction, mfa, trusted-devices, dossiers, e altre) --- vedi l'albero reale del
> repository per lo stato attuale.

```text
src/
  app/            # route Next.js (App Router)
    (auth)/         # login, register, forgot-password, check-email, verify-account
    (app)/          # dashboard, documents, reminders, assets, ... --- richiede sessione valida
    auth/confirm/   # Route Handler per il link di conferma email
  components/     # componenti UI, per feature (a specchio di domain/)
  lib/            # infrastruttura generica, non legata a una singola feature
  domain/         # tipi + repository per entità, un fetch/CRUD alla volta
  types/          # tipi condivisi (incl. supabase.ts, schema del DB)
  proxy.ts        # refresh della sessione Supabase su ogni richiesta

tests/
  unit/           # Vitest, incl. test di integrazione contro il DB reale
  e2e/            # Playwright

supabase/
  migrations/     # migration SQL, applicate con `supabase db push`
  seed/           # dati di seed per sviluppo/test
```

Principio architetturale: separare sempre **UI**, **domain logic**, **persistence**, **crypto** e **AI**.

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
   e `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API). Compila anche
   `RESEND_API_KEY` ed `EMAIL_FROM` (un indirizzo sul dominio verificato su
   [Resend](https://resend.com)), usati per le email che Hinthial invia da sé;
   senza queste due variabili quelle email non partono, ma il resto dell'app funziona comunque.
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
   [Resend](https://resend.com), gratuito) in **Authentication → SMTP Settings**:
   il mailer condiviso di Supabase è limitato a **2 email/ora**, con SMTP personalizzato sale
   a 30/ora. Un sender Resend non verificato consegna solo all'indirizzo del proprietario
   dell'account Resend --- serve un dominio verificato per testare con altri destinatari.

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
                        # dispositivi sulla stessa rete locale (crypto.subtle richiede un
                        # "secure context": localhost o HTTPS, un IP LAN in HTTP non basta).
                        # Richiede un certificato locale via mkcert (certificates/, gitignored):
                        # `mkcert -install`, poi
                        # `mkcert -key-file certificates/localhost-key.pem -cert-file certificates/localhost.pem localhost 127.0.0.1 ::1 <IP-LAN-del-PC>`.
                        # Il browser sull'altro dispositivo segnalerà il certificato come non
                        # affidabile (normale, autofirmato): procedi comunque.
```

Il test e2e di registrazione (`la registrazione crea un account`) usa
l'indirizzo email opzionale `E2E_REGISTRATION_TEST_EMAIL` (vedi
`.env.example`); se non configurato viene saltato automaticamente.

**`npm run reset-dev-data`** --- solo sviluppo: elimina tutti gli utenti a cascata e svuota il bucket Storage,
lasciando intatti schema e migration. Richiede `SUPABASE_SERVICE_ROLE_KEY`. **Mai** su un progetto con dati reali.

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
- La `SUPABASE_SERVICE_ROLE_KEY` è usata dai test e da un solo punto dell'app: la cancellazione definitiva
  dell'account (`src/lib/account/actions.ts`), eseguita in una Server Action, mai nel browser.

Vedi [HINTHIAL_MVP.md](./HINTHIAL_MVP.md) sezione 3 per i dettagli.

## Cosa NON è ancora implementato

> Nota: questa sezione riflette ancora la FASE 8. Molte delle limitazioni descritte qui sotto (capsule non
> modificabili, niente export/AI, contatto fiduciario senza sblocco automatico) sono state superate da fasi
> successive --- vedi CHANGELOG.md per lo stato reale. Vedi sezione 12 della spec per l'elenco di ciò che non va
> costruito nella prima versione del prodotto.

## Come contribuire (per Claude Code / agenti)

Vedi sezione 14 della spec ("Regole per Claude Code"): una fase alla
volta, con lint, typecheck e test verdi prima di considerarla completa.

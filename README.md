# HINTHIAL

Personal Life OS per organizzare, proteggere e rendere utilizzabili nel
tempo le informazioni importanti della vita di una persona.

> Metti ordine nella tua vita digitale, proteggi ciò che conta e rendi le
> informazioni importanti accessibili alle persone giuste quando serve.

Lo sviluppo segue la spec di prodotto/tecnica in
[HINTHIAL_MVP.md](./HINTHIAL_MVP.md), procedendo **una fase alla volta**
(vedi sezione 6 e 16 della spec per il piano completo).

## Stato del progetto

**FASE 0 --- Bootstrap**, **FASE 1 --- Shell dell'app** e
**FASE 2 --- Supabase Auth + database** completate.

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

## Stack

- **Frontend**: Next.js (App Router) + React + TypeScript (strict) + Tailwind CSS
- **Backend/DB**: Supabase (PostgreSQL, Auth, Row Level Security) --- collegato dalla FASE 2; Storage ancora da collegare (FASE 4)
- **Crittografia**: modulo client-side dedicato, libreria consolidata, mai primitive custom (FASE 3)
- **Test**: Vitest (unit) + Playwright (e2e)
- **Lint/Type checking**: ESLint + TypeScript strict mode

## Struttura del repository

```text
src/
  app/            # route Next.js (App Router)
    (auth)/         # login, registrazione --- nessuna sessione richiesta
    (app)/          # dashboard, vault, reminders, assets, contacts,
                     # capsules, ai, settings --- layout condiviso che
                     # richiede una sessione Supabase valida
  components/     # componenti UI
    ui/
    layout/
    vault/
    dashboard/
  lib/            # infrastruttura
    auth/           # Server Actions (signUp/signIn/signOut), current-user
    db/supabase/    # client Supabase (browser/server/middleware)
    crypto/         # FASE 3
    storage/        # FASE 4
    audit/          # log-event.ts --- eventi tecnici non sensibili
    ai/             # FASE 10+
  domain/         # logica di dominio: documents, assets, reminders, contacts, capsules
  types/          # tipi condivisi (incl. supabase.ts, schema del DB)
  proxy.ts        # refresh della sessione Supabase su ogni richiesta

tests/
  unit/           # test Vitest, incl. rls.integration.test.ts (RLS su DB reale)
  e2e/            # test Playwright

supabase/
  migrations/     # migration SQL, applicate con `supabase db push`
  seed/           # dati di seed per sviluppo/test
```

Principio architetturale: separare sempre **UI**, **domain logic**,
**persistence**, **crypto** e **AI** (vedi sezione 4 della spec).

## Requisiti

- Node.js 20+ (LTS)
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
- Nessuna primitiva crittografica custom: si useranno librerie
  consolidate, con revisione di sicurezza dedicata prima di considerare
  il modulo crypto production-ready.
- Row Level Security su ogni tabella: ogni record è accessibile solo al
  proprietario --- verificato da `tests/unit/rls.integration.test.ts`
  contro un database reale (due utenti usa-e-getta, mai dati reali).
- Il database contiene solo metadati tecnici minimi indispensabili.
- La `SUPABASE_SERVICE_ROLE_KEY` non è mai usata dall'app: esiste solo
  nei test, per creare/eliminare utenti di prova via API admin.

Vedi [HINTHIAL_MVP.md](./HINTHIAL_MVP.md) sezione 3 per i dettagli.

## Cosa NON è ancora implementato

Coerentemente con il piano a fasi, in questa release non sono presenti:
cifratura, vault, scadenze, asset, contatti fiduciari, capsule, export,
AI. Le pagine di queste sezioni esistono solo come placeholder
navigabili, protetti da autenticazione reale ma senza logica di
prodotto. Vedi sezione 12 della spec per l'elenco completo di ciò che
non va costruito nella prima versione del prodotto.

## Come contribuire (per Claude Code / agenti)

Vedi sezione 14 della spec ("Regole per Claude Code"): una fase alla
volta, con lint, typecheck e test verdi prima di considerarla completa.

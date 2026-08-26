# HINTHIAL

Personal Life OS per organizzare, proteggere e rendere utilizzabili nel
tempo le informazioni importanti della vita di una persona.

> Metti ordine nella tua vita digitale, proteggi ciò che conta e rendi le
> informazioni importanti accessibili alle persone giuste quando serve.

Lo sviluppo segue la spec di prodotto/tecnica in
[HINTHIAL_MVP.md](./HINTHIAL_MVP.md), procedendo **una fase alla volta**
(vedi sezione 6 e 16 della spec per il piano completo).

## Stato del progetto

**FASE 0 --- Bootstrap** e **FASE 1 --- Shell dell'app** completate.

La FASE 1 aggiunge landing, login, registrazione, dashboard vuota e la
navigazione principale (Dashboard, Vault, Scadenze, Asset, Contatti,
Capsule, AI, Impostazioni). L'autenticazione è ancora **mockata**
lato client (`src/lib/auth/mock-session.ts`): non c'è alcun account
reale, nessuna verifica delle credenziali e nessuna password persistita.
Serve solo a rendere la shell navigabile end-to-end prima di collegare
Supabase Auth in FASE 2, che sostituirà interamente questo modulo.

## Stack

- **Frontend**: Next.js (App Router) + React + TypeScript (strict) + Tailwind CSS
- **Backend/DB**: Supabase (PostgreSQL, Auth, Row Level Security, Storage) --- non ancora collegato (FASE 2)
- **Crittografia**: modulo client-side dedicato, libreria consolidata, mai primitive custom (FASE 3)
- **Test**: Vitest (unit) + Playwright (e2e)
- **Lint/Type checking**: ESLint + TypeScript strict mode

## Struttura del repository

```text
src/
  app/            # route Next.js (App Router)
    (auth)/
    dashboard/
    vault/
    reminders/
    assets/
    contacts/
    capsules/
    ai/
    settings/
  components/     # componenti UI
    ui/
    layout/
    vault/
    dashboard/
  lib/            # infrastruttura: auth, crypto, db, storage, audit, ai
  domain/         # logica di dominio: documents, assets, reminders, contacts, capsules
  types/          # tipi condivisi

tests/
  unit/           # test Vitest
  e2e/            # test Playwright

supabase/
  migrations/     # migration SQL (FASE 2+)
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
# valorizzare le variabili in .env.local quando Supabase sarà configurato (FASE 2)
```

## Comandi

```bash
npm run dev         # avvia il server di sviluppo (http://localhost:3000)
npm run build        # build di produzione
npm run start         # avvia la build di produzione
npm run lint          # ESLint
npm run typecheck     # TypeScript in modalità --noEmit
npm run test           # unit test (Vitest)
npm run test:watch     # unit test in watch mode
npm run test:e2e        # end-to-end test (Playwright; esegue build + start automaticamente)
```

## Sicurezza e privacy --- principi guida

- La cifratura dei contenuti avviene **lato client**, prima di qualsiasi
  upload. Il server non deve mai ricevere plaintext dei documenti né la
  master password.
- Nessuna primitiva crittografica custom: si useranno librerie
  consolidate, con revisione di sicurezza dedicata prima di considerare
  il modulo crypto production-ready.
- Row Level Security su ogni tabella: ogni record è accessibile solo al
  proprietario.
- Il database contiene solo metadati tecnici minimi indispensabili.

Vedi [HINTHIAL_MVP.md](./HINTHIAL_MVP.md) sezione 3 per i dettagli.

## Cosa NON è ancora implementato

Coerentemente con il piano a fasi, in questa release non sono presenti:
autenticazione reale (Supabase Auth), cifratura, vault, scadenze, asset,
contatti fiduciari, capsule, export, AI. Le pagine di queste sezioni
esistono solo come placeholder navigabili. Vedi sezione 12 della spec per
l'elenco completo di ciò che non va costruito nella prima versione del
prodotto.

## Come contribuire (per Claude Code / agenti)

Vedi sezione 14 della spec ("Regole per Claude Code"): una fase alla
volta, con lint, typecheck e test verdi prima di considerarla completa.

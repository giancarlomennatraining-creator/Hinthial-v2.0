-- FASE 12, secondo passo --- rilevamento inattività e promemoria (fasi
-- 1-3 della roadmap: v. HINTHIAL_MVP.md sezione 10). Opt-in esplicito
-- (v. richiesta utente, discussa a fondo prima di scrivere questa
-- migrazione): `digital_legacy_enabled` parte spento per ogni account,
-- esistente o nuovo --- nessuna email parte finché l'utente non lo
-- accende lui stesso in Impostazioni > Eredità digitale, qualunque
-- preset sia già configurato.
alter table public.profiles
  add column digital_legacy_enabled boolean not null default false,
  add column digital_legacy_state text not null default 'normal'
    check (digital_legacy_state in ('normal', 'reminding', 'grace_period', 'awaiting_guardians')),
  add column digital_legacy_state_entered_at timestamptz not null default now(),
  add column digital_legacy_reminders_sent integer not null default 0,
  add column digital_legacy_last_reminder_at timestamptz;

comment on column public.profiles.digital_legacy_enabled is
  'Se il monitoraggio per inattività di "Eredità digitale" è attivo --- spento di default per ogni account, opt-in esplicito. Finché è spento, il cron (v. app/api/cron/digital-legacy) ignora completamente questo account.';
comment on column public.profiles.digital_legacy_state is
  'Stato corrente della macchina a stati di "Eredità digitale" (v. domain/digital-legacy/types.ts, computeDigitalLegacyTransition) --- "awaiting_guardians" è un punto fermo: il periodo di grazia è scaduto, in attesa di una fase futura (coinvolgimento guardiani) non ancora costruita.';
comment on column public.profiles.digital_legacy_state_entered_at is
  'Quando è iniziato lo stato corrente --- usato per calcolare da quanto tempo ci si trova in questa fase, e per riconoscere un accesso avvenuto DOPO l''inizio dello stato (che annulla tutto, v. computeDigitalLegacyTransition).';
comment on column public.profiles.digital_legacy_reminders_sent is
  'Quanti promemoria sono già stati inviati nello stato "reminding" attuale --- azzerato ogni volta che si torna a "normal".';
comment on column public.profiles.digital_legacy_last_reminder_at is
  'Quando è stato inviato l''ultimo promemoria --- null finché non ne è mai stato inviato uno in questo stato.';

-- Ogni transizione deve essere auditabile (v. HINTHIAL_MVP.md sezione 10).
alter table public.audit_events drop constraint audit_events_event_type_check;
alter table public.audit_events
  add constraint audit_events_event_type_check
  check (event_type in (
    'login',
    'logout',
    'login_failed',
    'mfa_challenge_failed',
    'mfa_enrolled',
    'mfa_removed',
    'backup_codes_generated',
    'document_created',
    'document_deleted',
    'asset_created',
    'asset_deleted',
    'capsule_created',
    'capsule_deleted',
    'category_created',
    'category_deleted',
    'friend_added',
    'vault_wiped',
    'ai_chat_used',
    'trusted_device_registered',
    'trusted_device_revoked',
    'digital_legacy_reminder_sent',
    'digital_legacy_grace_period_started',
    'digital_legacy_awaiting_guardians',
    'digital_legacy_reset'
  ));

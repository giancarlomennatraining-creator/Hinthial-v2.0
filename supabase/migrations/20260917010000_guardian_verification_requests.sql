-- FASE 12, terzo passo --- coinvolgimento dei guardiani (fase 4 della
-- roadmap): quando il periodo di grazia scade senza risposta (v.
-- domain/digital-legacy/automation.ts, stato "awaiting_guardians"),
-- ogni guardiano COLLEGATO (v. friends.linked_user_id --- un guardiano
-- senza account non è raggiungibile dal server, v. commento in
-- FriendsPanel.tsx) riceve una richiesta di verifica: "sta bene?" /
-- "non so" / "confermo che non riesco a raggiungerlo". Una riga per
-- coppia (proprietario, guardiano) --- upsert a ogni nuovo episodio
-- (v. unique sotto), non un elenco che cresce senza fine.
create table public.guardian_verification_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  guardian_user_id uuid not null references auth.users (id) on delete cascade,
  -- Solo per risalire al contatto sul lato del proprietario (nome/ruolo
  -- restano cifrati, illeggibili qui) --- null se il contatto viene
  -- eliminato in seguito, la richiesta/risposta resta comunque valida.
  friend_id uuid references public.friends (id) on delete set null,
  response text check (response in ('ok', 'unknown', 'unreachable')),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (owner_id, guardian_user_id)
);

create index guardian_verification_requests_owner_idx on public.guardian_verification_requests (owner_id);
create index guardian_verification_requests_guardian_idx on public.guardian_verification_requests (guardian_user_id);

comment on table public.guardian_verification_requests is
  'FASE 12 --- una riga per (proprietario, guardiano collegato) per l''episodio di verifica in corso. response null finché il guardiano non risponde; created_at si azzera a ogni nuovo episodio (upsert, v. automation.ts). Righe cancellate quando l''episodio si annulla (reset), conservate se il quorum viene raggiunto (prova di chi ha confermato cosa, per la futura verifica formale).';

alter table public.guardian_verification_requests enable row level security;

-- Sia il proprietario sia il guardiano possono leggere --- nessun dato
-- sensibile qui (solo id, timestamp, la risposta in chiaro "ok/unknown/
-- unreachable"): trasparenza in entrambe le direzioni.
create policy "guardian_verification_requests_select_owner"
  on public.guardian_verification_requests for select
  to authenticated
  using (auth.uid() = owner_id);

create policy "guardian_verification_requests_select_guardian"
  on public.guardian_verification_requests for select
  to authenticated
  using (auth.uid() = guardian_user_id);

-- Solo il guardiano può rispondere alla PROPRIA riga --- mai il
-- proprietario, mai un altro guardiano. Niente insert/delete per gli
-- utenti: le righe nascono e muoiono solo lato server (v.
-- domain/digital-legacy/automation.ts, service role).
create policy "guardian_verification_requests_update_guardian"
  on public.guardian_verification_requests for update
  to authenticated
  using (auth.uid() = guardian_user_id)
  with check (auth.uid() = guardian_user_id);

-- Nuovo stato della macchina a stati (v. domain/digital-legacy/types.ts):
-- il quorum dei guardiani è stato raggiunto --- punto fermo per questo
-- incremento, in attesa della futura fase di verifica formale.
alter table public.profiles drop constraint profiles_digital_legacy_state_check;
alter table public.profiles
  add constraint profiles_digital_legacy_state_check
  check (digital_legacy_state in ('normal', 'reminding', 'grace_period', 'awaiting_guardians', 'guardians_confirmed'));

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
    'digital_legacy_reset',
    'digital_legacy_guardian_requested',
    'digital_legacy_guardian_responded',
    'digital_legacy_guardians_confirmed',
    'digital_legacy_reset_by_guardian'
  ));

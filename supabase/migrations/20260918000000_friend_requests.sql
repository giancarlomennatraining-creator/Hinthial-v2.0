-- Modello Amici v2 (1/2) --- v. richiesta utente: PERSONA (contatto
-- privato, un solo verso) vs AMICO (amicizia reciproca, confermata da
-- entrambi). "friends" resta la tabella di base --- ogni riga è sempre
-- una PERSONA nella rubrica di chi la possiede; diventa un'AMICIZIA vera
-- solo quando `is_friend` è true, cosa che succede SOLO accettando una
-- richiesta (mai impostabile direttamente dal proprietario, a differenza
-- di `status`/`is_guardian` finora).

alter table public.friends
  add column is_friend boolean not null default false;

comment on column public.friends.is_friend is
  'true solo se l''amicizia è stata richiesta ED accettata da entrambe le parti (v. friend_requests) --- non impostabile direttamente, a differenza di status/is_guardian.';

-- ---------------------------------------------------------------------
-- friend_requests --- richiesta di amicizia tra due account Hinthial.
-- ---------------------------------------------------------------------

create table public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  -- Snapshot in chiaro dell'email di chi invia, presa dalla sua stessa
  -- sessione al momento dell'invio --- serve al destinatario, se accetta,
  -- per creare la propria riga cifrata dell'amico (v. domain/friends,
  -- acceptFriendRequest): l'email del mittente non è altrimenti leggibile
  -- da chi la riceve (non vive su profiles, e non è cifrata per lui).
  sender_email text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create index friend_requests_sender_idx on public.friend_requests (sender_id);
create index friend_requests_recipient_idx on public.friend_requests (recipient_id);

-- Una sola richiesta IN SOSPESO per coppia --- non blocca però un nuovo
-- tentativo dopo un rifiuto: le righe rifiutate/accettate restano come
-- storico, non vengono mai cancellate.
create unique index friend_requests_unique_pending
  on public.friend_requests (sender_id, recipient_id)
  where status = 'pending';

alter table public.friend_requests enable row level security;

create policy "friend_requests_select_sender"
  on public.friend_requests for select to authenticated
  using (auth.uid() = sender_id);

create policy "friend_requests_select_recipient"
  on public.friend_requests for select to authenticated
  using (auth.uid() = recipient_id);

create policy "friend_requests_insert_sender"
  on public.friend_requests for insert to authenticated
  with check (auth.uid() = sender_id and sender_id <> recipient_id);

-- Nessuna policy di update/delete per gli utenti --- lo stato cambia
-- SOLO tramite le funzioni sotto: altrimenti il mittente potrebbe
-- scriversi da solo "accepted", falsificando il consenso del destinatario.

create or replace function public.accept_friend_request(request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_id uuid;
  v_recipient_id uuid;
begin
  update public.friend_requests
  set status = 'accepted', responded_at = now()
  where id = request_id and recipient_id = auth.uid() and status = 'pending'
  returning sender_id, recipient_id into v_sender_id, v_recipient_id;

  if v_sender_id is null then
    return;
  end if;

  -- Entrambe le righe (quella del mittente sull'altro, e quella del
  -- destinatario sul mittente, se esiste già) diventano AMICO --- un
  -- semplice flag booleano, nessun dato cifrato coinvolto qui.
  update public.friends set is_friend = true
    where owner_id = v_sender_id and linked_user_id = v_recipient_id;
  update public.friends set is_friend = true
    where owner_id = v_recipient_id and linked_user_id = v_sender_id;

  insert into public.audit_events (owner_id, event_type) values (v_sender_id, 'friend_request_accepted');
  insert into public.audit_events (owner_id, event_type) values (v_recipient_id, 'friend_request_accepted');
end;
$$;

revoke all on function public.accept_friend_request(uuid) from public;
grant execute on function public.accept_friend_request(uuid) to authenticated;

create or replace function public.reject_friend_request(request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_id uuid;
begin
  update public.friend_requests
  set status = 'rejected', responded_at = now()
  where id = request_id and recipient_id = auth.uid() and status = 'pending'
  returning sender_id into v_sender_id;

  if v_sender_id is null then
    return;
  end if;

  insert into public.audit_events (owner_id, event_type) values (v_sender_id, 'friend_request_rejected');
  insert into public.audit_events (owner_id, event_type) values (auth.uid(), 'friend_request_rejected');
end;
$$;

revoke all on function public.reject_friend_request(uuid) from public;
grant execute on function public.reject_friend_request(uuid) to authenticated;

-- Il destinatario deve poter leggere il nome (in chiaro) di chi gli ha
-- mandato una richiesta --- stesso schema già usato per il guardiano che
-- legge il nome del proprietario (v. profiles_select_by_guardian).
create policy "profiles_select_by_friend_request_sender"
  on public.profiles for select to authenticated
  using (exists (
    select 1 from public.friend_requests fr
    where fr.sender_id = profiles.id and fr.recipient_id = auth.uid()
  ));

-- ---------------------------------------------------------------------
-- audit_events: widen event_type for the 3 new friend-request events.
-- ---------------------------------------------------------------------

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
    'digital_legacy_reset_by_guardian',
    'digital_legacy_formal_verification_started',
    'digital_legacy_final_wait_started',
    'digital_legacy_triggered',
    'friend_request_sent',
    'friend_request_accepted',
    'friend_request_rejected'
  ));

-- Modello Amici v2 (2/2) --- v. richiesta utente: diventare guardiano
-- richiede ora un consenso esplicito (richiesta + accetta/rifiuta), non
-- più un flag che il proprietario impostava da solo su un amico ignaro.
-- Solo un AMICO (is_friend = true) può essere candidato guardiano ---
-- una PERSONA no, per costruzione (v. policy di insert sotto).
--
-- Conseguenza della migrazione precedente (tutti gli amici esistenti
-- diventano PERSONE): chiunque fosse già guardiano nel vecchio modello
-- perde quel ruolo qui sotto, e dovrà essere richiesto di nuovo con il
-- nuovo flusso --- deciso esplicitamente dall'utente (punto 3/4 della
-- discussione), sapendo che chi ha già configurato Eredità digitale
-- potrebbe ritrovarsi temporaneamente senza guardiani confermati.

update public.friends set is_guardian = false where is_guardian = true;

create table public.guardian_role_requests (
  id uuid primary key default gen_random_uuid(),
  -- Chi vuole un guardiano (il futuro "protetto").
  owner_id uuid not null references auth.users (id) on delete cascade,
  -- A chi viene chiesto di fare da guardiano.
  guardian_user_id uuid not null references auth.users (id) on delete cascade,
  -- La riga "amico" del proprietario per questo guardiano --- aggiornata
  -- direttamente (is_guardian) quando la richiesta viene accettata/tolta.
  friend_id uuid references public.friends (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create index guardian_role_requests_owner_idx on public.guardian_role_requests (owner_id);
create index guardian_role_requests_guardian_idx on public.guardian_role_requests (guardian_user_id);

create unique index guardian_role_requests_unique_pending
  on public.guardian_role_requests (owner_id, guardian_user_id)
  where status = 'pending';

alter table public.guardian_role_requests enable row level security;

create policy "guardian_role_requests_select_owner"
  on public.guardian_role_requests for select to authenticated
  using (auth.uid() = owner_id);

create policy "guardian_role_requests_select_guardian"
  on public.guardian_role_requests for select to authenticated
  using (auth.uid() = guardian_user_id);

-- Solo un AMICO può essere candidato: la riga amico indicata deve
-- appartenere a chi crea la richiesta, puntare davvero all'account
-- guardiano candidato, ed essere già is_friend = true.
create policy "guardian_role_requests_insert_owner"
  on public.guardian_role_requests for insert to authenticated
  with check (
    auth.uid() = owner_id
    and owner_id <> guardian_user_id
    and exists (
      select 1 from public.friends f
      where f.id = friend_id
        and f.owner_id = auth.uid()
        and f.linked_user_id = guardian_user_id
        and f.is_friend = true
    )
  );

-- Nessuna policy di update/delete per gli utenti --- come friend_requests,
-- ogni transizione passa da una delle funzioni sotto.

create or replace function public.accept_guardian_role_request(request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_friend_id uuid;
begin
  update public.guardian_role_requests
  set status = 'accepted', responded_at = now()
  where id = request_id and guardian_user_id = auth.uid() and status = 'pending'
  returning owner_id, friend_id into v_owner_id, v_friend_id;

  if v_owner_id is null then
    return;
  end if;

  if v_friend_id is not null then
    update public.friends set is_guardian = true where id = v_friend_id;
  end if;

  insert into public.audit_events (owner_id, event_type) values (v_owner_id, 'guardian_role_accepted');
  insert into public.audit_events (owner_id, event_type) values (auth.uid(), 'guardian_role_accepted');
end;
$$;

revoke all on function public.accept_guardian_role_request(uuid) from public;
grant execute on function public.accept_guardian_role_request(uuid) to authenticated;

create or replace function public.reject_guardian_role_request(request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
begin
  update public.guardian_role_requests
  set status = 'rejected', responded_at = now()
  where id = request_id and guardian_user_id = auth.uid() and status = 'pending'
  returning owner_id into v_owner_id;

  if v_owner_id is null then
    return;
  end if;

  insert into public.audit_events (owner_id, event_type) values (v_owner_id, 'guardian_role_rejected');
  insert into public.audit_events (owner_id, event_type) values (auth.uid(), 'guardian_role_rejected');
end;
$$;

revoke all on function public.reject_guardian_role_request(uuid) from public;
grant execute on function public.reject_guardian_role_request(uuid) to authenticated;

-- Il PROPRIETARIO rimuove un guardiano direttamente (nessun consenso
-- richiesto per TOGLIERE la responsabilità a qualcuno, solo per darla)
-- --- una funzione, non una policy di update, per poter aggiornare in un
-- solo colpo sia friends.is_guardian sia la richiesta corrispondente.
create or replace function public.revoke_guardian_role(p_friend_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guardian_user_id uuid;
begin
  update public.friends
  set is_guardian = false
  where id = p_friend_id and owner_id = auth.uid()
  returning linked_user_id into v_guardian_user_id;

  if v_guardian_user_id is null then
    return;
  end if;

  update public.guardian_role_requests
  set status = 'rejected', responded_at = now()
  where owner_id = auth.uid() and guardian_user_id = v_guardian_user_id and status = 'accepted';

  insert into public.audit_events (owner_id, event_type) values (auth.uid(), 'guardian_role_revoked');
  insert into public.audit_events (owner_id, event_type) values (v_guardian_user_id, 'guardian_role_revoked');
end;
$$;

revoke all on function public.revoke_guardian_role(uuid) from public;
grant execute on function public.revoke_guardian_role(uuid) to authenticated;

-- Il GUARDIANO si dimette da solo --- la controparte simmetrica di
-- revoke_guardian_role, ma iniziata da chi porta il ruolo, non da chi
-- l'ha richiesto (v. richiesta utente: visibilità reciproca --- PROTETTO
-- deve poter significare anche "posso smettere quando voglio").
create or replace function public.resign_as_guardian(request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
  v_friend_id uuid;
begin
  update public.guardian_role_requests
  set status = 'rejected', responded_at = now()
  where id = request_id and guardian_user_id = auth.uid() and status = 'accepted'
  returning owner_id, friend_id into v_owner_id, v_friend_id;

  if v_owner_id is null then
    return;
  end if;

  if v_friend_id is not null then
    update public.friends set is_guardian = false where id = v_friend_id;
  end if;

  insert into public.audit_events (owner_id, event_type) values (v_owner_id, 'guardian_role_resigned');
  insert into public.audit_events (owner_id, event_type) values (auth.uid(), 'guardian_role_resigned');
end;
$$;

revoke all on function public.resign_as_guardian(uuid) from public;
grant execute on function public.resign_as_guardian(uuid) to authenticated;

-- Il guardiano candidato deve poter leggere il nome (in chiaro) del
-- proprietario che lo ha indicato --- stesso schema già usato per
-- friend_requests/guardian_verification_requests.
create policy "profiles_select_by_guardian_role_request"
  on public.profiles for select to authenticated
  using (exists (
    select 1 from public.guardian_role_requests grr
    where grr.owner_id = profiles.id and grr.guardian_user_id = auth.uid()
  ));

-- ---------------------------------------------------------------------
-- audit_events: widen event_type for the 5 new guardian-role events.
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
    'friend_request_rejected',
    'guardian_role_requested',
    'guardian_role_accepted',
    'guardian_role_rejected',
    'guardian_role_revoked',
    'guardian_role_resigned'
  ));

-- FASE 12, quarto e ultimo passo --- verifica formale, attesa finale,
-- apertura capsule (fasi 5-7 della roadmap). Discusso esplicitamente
-- con l'utente prima di scrivere questa migrazione: l'irraggiungibilità
-- confermata dai guardiani diventa un secondo modo, indipendente dalla
-- data di apertura scelta alla creazione, di far scattare l'accesso
-- alle capsule già condivise --- altrimenti le fasi 1-6 non avrebbero
-- nessun effetto reale, solo sullo stato interno dell'account.
alter table public.profiles
  add column digital_legacy_triggered_at timestamptz;

comment on column public.profiles.digital_legacy_triggered_at is
  'Quando "Eredità digitale" ha davvero fatto scattare l''apertura delle capsule --- null finché non succede, e MAI azzerato da un reset successivo (a differenza di digital_legacy_state, che può tornare "normal" con un accesso del proprietario): l''accesso già concesso ai destinatari non si può ritirare. Controllato dalle policy su capsule_share_keys/storage.objects qui sotto, in OR con la open_at di ogni singola capsula.';

alter table public.profiles drop constraint profiles_digital_legacy_state_check;
alter table public.profiles
  add constraint profiles_digital_legacy_state_check
  check (digital_legacy_state in (
    'normal',
    'reminding',
    'grace_period',
    'awaiting_guardians',
    'guardians_confirmed',
    'formal_verification',
    'final_wait',
    'triggered'
  ));

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
    'digital_legacy_triggered'
  ));

-- Il cuore della fase 7: il destinatario vede la riga anche PRIMA di
-- open_at se "Eredità digitale" è scattata per il proprietario --- due
-- condizioni indipendenti in OR, non una sostituisce l'altra.
drop policy "capsule_share_keys_select_recipient_after_open" on public.capsule_share_keys;
create policy "capsule_share_keys_select_recipient_after_open"
  on public.capsule_share_keys for select
  to authenticated
  using (
    auth.uid() = recipient_user_id
    and (
      exists (
        select 1 from public.capsules c
        where c.id = capsule_share_keys.capsule_id
          and c.open_at is not null
          and c.open_at <= now()
      )
      or exists (
        select 1 from public.profiles p
        where p.id = capsule_share_keys.owner_id
          and p.digital_legacy_triggered_at is not null
      )
    )
  );

-- Stessa condizione anche per gli allegati in Storage --- v. commento
-- originale nella migrazione capsule_share_keys: non basta negare la
-- riga che descrive le chiavi, va negato anche il blob cifrato in sé.
drop policy "encrypted_capsules_select_shared_recipient" on storage.objects;
create policy "encrypted_capsules_select_shared_recipient"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'encrypted-capsules'
    and exists (
      select 1 from public.capsule_shares cs
      join public.capsules c on c.id = cs.capsule_id
      join public.profiles p on p.id = c.owner_id
      where cs.recipient_user_id = auth.uid()
        and c.owner_id::text = (storage.foldername(name))[1]
        and c.id::text = (storage.foldername(name))[2]
        and (
          (c.open_at is not null and c.open_at <= now())
          or p.digital_legacy_triggered_at is not null
        )
    )
  );

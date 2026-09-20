-- FASE 20 --- Fascicoli.
--
-- Un oggetto nuovo, **trasversale alle categorie**: una categoria è un
-- cassetto (Salute, Assicurazioni, ...); un fascicolo è una storia che
-- attraversa più cassetti (un problema di salute, l'acquisto di una
-- casa, un incidente). Per questo `dossier_id` su `documents` è
-- indipendente da `category_id` e `related_asset_id`: un documento può
-- avere tutti e tre insieme.
--
-- Nessuna IA qui: creazione e collegamento sono manuali (v.
-- HINTHIAL_MVP.md, FASE 20). Il titolo/la descrizione sono cifrati come
-- ogni altro contenuto testuale dell'utente; lo stato (aperto/chiuso) e
-- le date restano in chiaro --- lo stesso livello di dettaglio che il
-- server ha già su una capsula (`status`) o su un documento
-- (`category_id`, `expires_at`).

create table public.dossiers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  encrypted_title text not null,
  -- null e non stringa vuota cifrata: una descrizione mai scritta non
  -- deve costare un giro di cifratura/decifratura in più, stesso schema
  -- di documents.encrypted_notes.
  encrypted_description text,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

comment on table public.dossiers is
  'Fascicolo per HINTHIAL_MVP.md FASE 20 --- vicende trasversali alle categorie. encrypted_title/encrypted_description sono opachi al server.';

create index dossiers_owner_id_created_at_idx
  on public.dossiers (owner_id, created_at desc);

alter table public.dossiers enable row level security;

create policy "dossiers_select_own"
  on public.dossiers for select
  using (auth.uid() = owner_id);

create policy "dossiers_insert_own"
  on public.dossiers for insert
  with check (auth.uid() = owner_id);

create policy "dossiers_update_own"
  on public.dossiers for update
  using (auth.uid() = owner_id);

create policy "dossiers_delete_own"
  on public.dossiers for delete
  using (auth.uid() = owner_id);

-- ---------------------------------------------------------------------
-- documents.dossier_id --- il collegamento vive sul documento, esattamente
-- come category_id e related_asset_id: si assegna dal form del
-- documento, non da una UI di gestione sul lato del fascicolo (stessa
-- scelta già fatta per beni e categorie). ON DELETE SET NULL: eliminare
-- un fascicolo scollega i documenti, non li elimina --- come già succede
-- eliminando un bene o una categoria.
-- ---------------------------------------------------------------------

alter table public.documents
  add column dossier_id uuid references public.dossiers(id) on delete set null;

create index documents_dossier_id_idx
  on public.documents (dossier_id)
  where dossier_id is not null;

-- ---------------------------------------------------------------------
-- audit_events: due tipi nuovi. Nessun "dossier_updated"/"_closed" a sé
-- --- stessa scelta già presa per asset_created/asset_deleted (nessun
-- asset_updated): non ogni modifica di un campo merita una voce propria
-- in Attività, solo la nascita e la fine dell'oggetto.
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
    'guardian_role_resigned',
    'proposal_accepted',
    'proposal_rejected',
    'proposal_undone',
    'dossier_created',
    'dossier_deleted'
  ));

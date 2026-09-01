-- FASE 7 --- Contatto fiduciario.
--
-- Struttura dati e UI di gestione per il TrustedContact (sezione 5 della
-- spec): nome ed email del contatto sono cifrati con la Master Key (dati
-- personali di terzi), ruolo e stato restano in chiaro --- etichette
-- gestionali, non contenuto, sullo stesso piano di categoria/mime_type
-- altrove. Per esplicita indicazione della spec, in questa fase NON si
-- implementa lo sblocco automatico dei dati: il contatto fiduciario è
-- solo una struttura dati e un elemento di autorizzazione futura ---
-- "stato invito" è quindi gestito manualmente (nessun invio email reale).

create table public.trusted_contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  -- Serialized EncryptedEnvelope, encrypted with the Master Key.
  encrypted_name text not null,
  encrypted_email text not null,
  role text not null,
  status text not null default 'pending' check (status in ('pending', 'active', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.trusted_contacts is
  'TrustedContact per HINTHIAL_MVP.md sezione 5 (FASE 7). Nessuno sblocco automatico dei dati in questa fase --- solo struttura dati + gestione dello stato.';

create index trusted_contacts_owner_id_created_at_idx
  on public.trusted_contacts (owner_id, created_at desc);

alter table public.trusted_contacts enable row level security;

create policy "trusted_contacts_select_own"
  on public.trusted_contacts for select
  to authenticated
  using (auth.uid() = owner_id);

create policy "trusted_contacts_insert_own"
  on public.trusted_contacts for insert
  to authenticated
  with check (auth.uid() = owner_id);

create policy "trusted_contacts_update_own"
  on public.trusted_contacts for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "trusted_contacts_delete_own"
  on public.trusted_contacts for delete
  to authenticated
  using (auth.uid() = owner_id);

create trigger trusted_contacts_set_updated_at
  before update on public.trusted_contacts
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- audit_events: widen event_type for trusted_contact_added
-- ---------------------------------------------------------------------

alter table public.audit_events drop constraint audit_events_event_type_check;
alter table public.audit_events
  add constraint audit_events_event_type_check
  check (event_type in ('login', 'logout', 'document_created', 'document_deleted', 'trusted_contact_added'));

-- FASE 5 --- Metadata e scadenze.
--
-- Adds optional metadata to documents (expiry date, encrypted notes,
-- encrypted tags) and a standalone reminders table, per
-- HINTHIAL_MVP.md sezione 5.
--
-- "relazione con asset" is deferred: the Asset entity doesn't exist
-- until FASE 6. reminders.related_document_id stands in as the only
-- possible relation for now; it will be generalized once Asset lands.

-- ---------------------------------------------------------------------
-- documents: new optional columns
-- ---------------------------------------------------------------------

alter table public.documents
  add column expires_at timestamptz,
  add column encrypted_notes text,
  add column encrypted_tags text;

comment on column public.documents.expires_at is
  'Plaintext (like created_at) --- a date alone isn''t sensitive content.';
comment on column public.documents.encrypted_notes is
  'Serialized EncryptedEnvelope: a free-text note, encrypted with the Master Key.';
comment on column public.documents.encrypted_tags is
  'Serialized EncryptedEnvelope: a JSON array of tag strings, encrypted with the Master Key.';

-- ---------------------------------------------------------------------
-- reminders
-- ---------------------------------------------------------------------

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  -- Serialized EncryptedEnvelope, encrypted with the Master Key.
  encrypted_title text not null,
  due_at timestamptz not null,
  related_document_id uuid references public.documents (id) on delete set null,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.reminders is
  'Reminder per HINTHIAL_MVP.md sezione 5. related_document_id is a placeholder relation until FASE 6 (Asset) generalizes it.';

create index reminders_owner_id_due_at_idx
  on public.reminders (owner_id, due_at);

alter table public.reminders enable row level security;

create policy "reminders_select_own"
  on public.reminders for select
  to authenticated
  using (auth.uid() = owner_id);

create policy "reminders_insert_own"
  on public.reminders for insert
  to authenticated
  with check (auth.uid() = owner_id);

create policy "reminders_update_own"
  on public.reminders for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "reminders_delete_own"
  on public.reminders for delete
  to authenticated
  using (auth.uid() = owner_id);

create trigger reminders_set_updated_at
  before update on public.reminders
  for each row
  execute function public.set_updated_at();

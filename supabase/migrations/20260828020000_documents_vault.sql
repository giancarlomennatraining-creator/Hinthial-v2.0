-- FASE 4 --- Vault documentale ("Documenti" nella UI).
--
-- Adds: encryption setup (wrapped Master Key), categories (plaintext,
-- fixed taxonomy per HINTHIAL_MVP.md sezione 5 --- not sensitive), and
-- documents (all sensitive fields already encrypted client-side before
-- they ever reach this database). Also a private Storage bucket for the
-- encrypted file payloads, per sezione 3: "Supabase Storage solo per
-- blob già cifrati lato client".

-- ---------------------------------------------------------------------
-- encryption_setup
-- ---------------------------------------------------------------------
-- One row per user: the Master Key (FASE 3), wrapped two independent
-- ways (password, recovery key). HINTHIAL never stores the master
-- password or the recovery key itself --- only these wrapped copies,
-- which are useless without one of the two.

create table public.encryption_setup (
  owner_id uuid primary key references auth.users (id) on delete cascade,
  master_key_wrapped_by_password text not null,
  master_key_wrapped_by_recovery_key text not null,
  pbkdf2_params text not null,
  created_at timestamptz not null default now()
);

comment on table public.encryption_setup is
  'Per-user Master Key setup (FASE 3 envelopes, serialized). No plaintext key material.';

alter table public.encryption_setup enable row level security;

create policy "encryption_setup_select_own"
  on public.encryption_setup for select
  to authenticated
  using (auth.uid() = owner_id);

create policy "encryption_setup_insert_own"
  on public.encryption_setup for insert
  to authenticated
  with check (auth.uid() = owner_id);

-- No update/delete policy for MVP: changing the master password isn't
-- implemented yet (a future phase), and setup happens once.

-- ---------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------
-- Fixed, non-sensitive taxonomy (sezione 5: "Categorie iniziali"). Names
-- are plaintext on purpose --- they're generic labels, not personal
-- content.

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  icon text not null,
  created_at timestamptz not null default now()
);

comment on table public.categories is
  'Category per HINTHIAL_MVP.md sezione 5. Seeded automatically for every new user.';

alter table public.categories enable row level security;

create policy "categories_select_own"
  on public.categories for select
  to authenticated
  using (auth.uid() = owner_id);

-- No insert/update/delete policy for authenticated users in FASE 4:
-- categories are seeded automatically (below) and there is no
-- category-management UI yet.

-- ---------------------------------------------------------------------
-- documents
-- ---------------------------------------------------------------------
-- Every field that could reveal something about the user's life
-- (filename, content) is an opaque encrypted envelope (see
-- src/lib/crypto/envelope.ts), serialized as JSON text. Only technical
-- metadata (mime type, size, category, timestamps) is plaintext, per
-- sezione 3: "Il server deve vedere al massimo metadati tecnici
-- minimi."

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  -- Serialized EncryptedEnvelope (the file name, encrypted with the Master Key).
  encrypted_filename text not null,
  -- Serialized EncryptedEnvelope (this document's random Document Key,
  -- wrapped by the Master Key). The encrypted file content itself lives
  -- in Storage, at storage_path --- see below.
  wrapped_document_key text not null,
  storage_path text not null unique,
  mime_type text not null,
  size bigint not null check (size >= 0),
  category_id uuid references public.categories (id) on delete set null,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.documents is
  'Document per HINTHIAL_MVP.md sezione 5. encrypted_filename/wrapped_document_key are opaque to the server; content ciphertext lives in Storage.';

create index documents_owner_id_created_at_idx
  on public.documents (owner_id, created_at desc);

alter table public.documents enable row level security;

create policy "documents_select_own"
  on public.documents for select
  to authenticated
  using (auth.uid() = owner_id);

create policy "documents_insert_own"
  on public.documents for insert
  to authenticated
  with check (auth.uid() = owner_id);

create policy "documents_delete_own"
  on public.documents for delete
  to authenticated
  using (auth.uid() = owner_id);

-- No update policy in FASE 4: there is no edit/rename feature yet.

create trigger documents_set_updated_at
  before update on public.documents
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Seed default categories + backfill for existing users
-- ---------------------------------------------------------------------

create function public.seed_default_categories(target_owner_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.categories (owner_id, name, icon)
  values
    (target_owner_id, 'Personale', '👤'),
    (target_owner_id, 'Casa', '🏠'),
    (target_owner_id, 'Veicoli', '🚗'),
    (target_owner_id, 'Assicurazioni', '🛡️'),
    (target_owner_id, 'Contratti', '📄'),
    (target_owner_id, 'Fiscale', '💰'),
    (target_owner_id, 'Salute', '❤️'),
    (target_owner_id, 'Finanze', '📊'),
    (target_owner_id, 'Account', '🔑'),
    (target_owner_id, 'Altro', '📦');
$$;

-- Extends the FASE 2 signup trigger to also seed default categories,
-- so every new user gets them automatically alongside their profile.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );

  perform public.seed_default_categories(new.id);

  return new;
end;
$$;

-- Backfill: any user created before this migration (FASE 2/3 test
-- accounts) won't have categories yet --- give them the defaults too.
do $$
declare
  existing_user record;
begin
  for existing_user in
    select id from auth.users
    where id not in (select owner_id from public.categories)
  loop
    perform public.seed_default_categories(existing_user.id);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- audit_events: widen event_type for document_created/document_deleted
-- ---------------------------------------------------------------------

alter table public.audit_events drop constraint audit_events_event_type_check;
alter table public.audit_events
  add constraint audit_events_event_type_check
  check (event_type in ('login', 'logout', 'document_created', 'document_deleted'));

-- ---------------------------------------------------------------------
-- Storage: private bucket for encrypted document payloads
-- ---------------------------------------------------------------------
-- Object path convention: {owner_id}/{document_id}.json (a serialized
-- EncryptedEnvelope --- ciphertext + iv, see src/lib/crypto/envelope.ts).
-- RLS scopes every operation to the first path segment matching the
-- caller's own user id, the standard Supabase per-user-folder pattern.

insert into storage.buckets (id, name, public)
values ('encrypted-documents', 'encrypted-documents', false);

create policy "encrypted_documents_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'encrypted-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "encrypted_documents_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'encrypted-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "encrypted_documents_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'encrypted-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

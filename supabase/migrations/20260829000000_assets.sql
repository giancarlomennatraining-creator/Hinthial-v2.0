-- FASE 6 --- Asset e relazioni.
--
-- Adds a simple asset inventory (per HINTHIAL_MVP.md sezione 6, esempio
-- "Casa -> Assicurazione -> Contratto -> Documento") and generalizes the
-- placeholder relation introduced in FASE 5: documents and reminders can
-- now each optionally link to one asset, in addition to (not instead of)
-- the existing reminder -> document link. Deliberately flat --- no
-- asset-to-asset hierarchy yet ("non creare subito un knowledge graph
-- complesso").

-- ---------------------------------------------------------------------
-- assets
-- ---------------------------------------------------------------------

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  -- Serialized EncryptedEnvelope (the asset's name, encrypted with the
  -- Master Key) --- an asset name ("Casa di Via Roma", "BMW targa ...")
  -- can reveal as much about a life as a document filename can.
  encrypted_name text not null,
  category_id uuid references public.categories (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.assets is
  'Asset per HINTHIAL_MVP.md sezione 6. encrypted_name is opaque to the server; reuses the same categories taxonomy as documents.';

create index assets_owner_id_created_at_idx
  on public.assets (owner_id, created_at desc);

alter table public.assets enable row level security;

create policy "assets_select_own"
  on public.assets for select
  to authenticated
  using (auth.uid() = owner_id);

create policy "assets_insert_own"
  on public.assets for insert
  to authenticated
  with check (auth.uid() = owner_id);

create policy "assets_update_own"
  on public.assets for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "assets_delete_own"
  on public.assets for delete
  to authenticated
  using (auth.uid() = owner_id);

create trigger assets_set_updated_at
  before update on public.assets
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- documents / reminders: optional asset relation
-- ---------------------------------------------------------------------

alter table public.documents
  add column related_asset_id uuid references public.assets (id) on delete set null;

alter table public.reminders
  add column related_asset_id uuid references public.assets (id) on delete set null;

comment on column public.reminders.related_asset_id is
  'Independent of related_document_id --- a reminder can relate to an asset directly (e.g. "pay car tax"), to a document, to both, or to neither.';

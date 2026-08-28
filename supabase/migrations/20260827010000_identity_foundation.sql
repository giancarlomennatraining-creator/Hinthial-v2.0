-- FASE 2 --- Auth + database.
--
-- Identity layer foundation: a per-user profile row and a technical
-- audit log for session events (login/logout). No product data
-- (documents, categories, assets, ...) is introduced here --- those
-- arrive with their own phases and their own migrations.
--
-- Every table enforces Row Level Security so a row is reachable only by
-- the user who owns it, per HINTHIAL_MVP.md sezione 6, FASE 2:
-- "ogni record appartenente a un utente deve essere accessibile
-- esclusivamente a quell'utente".

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'UserProfile per HINTHIAL_MVP.md sezione 5. One row per auth.users row, created automatically on sign up.';

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- No insert/delete policy for authenticated users: rows are created only
-- by the handle_new_user trigger below (as the table owner, bypassing
-- RLS) and removed only via the ON DELETE CASCADE from auth.users.

-- Keeps updated_at accurate on every UPDATE.
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- Creates the profile row automatically when a new auth user is created.
-- security definer: runs as the function owner so it can write to
-- public.profiles despite the new user having no rows-of-their-own yet
-- and RLS having no INSERT policy for authenticated users.
create function public.handle_new_user()
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
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- audit_events
-- ---------------------------------------------------------------------
-- Technical, non-sensitive event log (AuditEvent, sezione 5). Only the
-- event types produced by this phase are allowed for now; later phases
-- extend this constraint in their own migration when they add new event
-- types (document_created, trusted_contact_added, ...).

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  event_type text not null check (event_type in ('login', 'logout')),
  created_at timestamptz not null default now()
);

comment on table public.audit_events is
  'AuditEvent per HINTHIAL_MVP.md sezione 5. Non deve mai contenere contenuti, password, chiavi o plaintext.';

create index audit_events_owner_id_created_at_idx
  on public.audit_events (owner_id, created_at desc);

alter table public.audit_events enable row level security;

create policy "audit_events_select_own"
  on public.audit_events for select
  to authenticated
  using (auth.uid() = owner_id);

create policy "audit_events_insert_own"
  on public.audit_events for insert
  to authenticated
  with check (auth.uid() = owner_id);

-- No update/delete policy: the audit trail is append-only.

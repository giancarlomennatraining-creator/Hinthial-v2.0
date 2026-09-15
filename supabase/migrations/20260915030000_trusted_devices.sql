-- FASE 13, primo passo --- registro dei dispositivi "fidati" (v.
-- HINTHIAL_MVP.md): non contiene mai il Master Key né alcun segreto
-- che permetta di derivarlo --- quella copia locale, cifrata con una
-- chiave derivata dall'impronta/Face ID (WebAuthn PRF), vive solo nel
-- browser di ogni dispositivo (v. lib/device-lock-storage.ts). Questa
-- tabella serve solo a sapere QUALI dispositivi esistono, per poterli
-- elencare e revocare (v. fasi successive) --- credential_id è
-- l'identificativo pubblico della credenziale WebAuthn, non un segreto.
create table public.trusted_devices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  credential_id text not null,
  label text not null,
  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (owner_id, credential_id)
);

create index trusted_devices_owner_id_created_at_idx on public.trusted_devices (owner_id, created_at desc);

alter table public.trusted_devices enable row level security;

create policy "trusted_devices_select_own"
  on public.trusted_devices for select
  to authenticated
  using (auth.uid() = owner_id);

create policy "trusted_devices_insert_own"
  on public.trusted_devices for insert
  to authenticated
  with check (auth.uid() = owner_id);

create policy "trusted_devices_update_own"
  on public.trusted_devices for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "trusted_devices_delete_own"
  on public.trusted_devices for delete
  to authenticated
  using (auth.uid() = owner_id);

comment on table public.trusted_devices is
  'FASE 13 --- registro dei dispositivi autorizzati a sbloccare il vault via WebAuthn locale; non contiene mai il Master Key né materiale che permetta di derivarlo.';
comment on column public.trusted_devices.credential_id is
  'Identificativo pubblico (base64) della credenziale WebAuthn --- non un segreto.';

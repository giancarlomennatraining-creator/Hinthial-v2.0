-- FASE 13, secondo passo --- pairing tra dispositivi via QR code (v.
-- HINTHIAL_MVP.md): un dispositivo nuovo (es. un PC non ancora fidato)
-- genera una coppia di chiavi ECDH effimera e la mostra come QR code;
-- un dispositivo già fidato (lo smartphone) la scansiona, deriva un
-- segreto condiviso con la propria coppia effimera, e ci cifra il
-- Master Key --- questa tabella fa solo da tramite CIECO tra i due: il
-- server non vede mai né il Master Key né alcuna chiave capace di
-- derivarlo, solo chiavi pubbliche effimere e un blob già cifrato.
--
-- Entrambe le righe (chi crea la richiesta e chi la approva) sono
-- sempre lo stesso account Hinthial --- non un condividere tra utenti
-- diversi come capsule/friends --- quindi bastano le solite policy
-- "owner_id = auth.uid()" su entrambi i lati.
create table public.device_pairing_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  new_device_public_key text not null,
  approver_public_key text,
  encrypted_master_key text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '5 minutes')
);

create index device_pairing_requests_owner_id_idx on public.device_pairing_requests (owner_id);

alter table public.device_pairing_requests enable row level security;

create policy "device_pairing_requests_select_own"
  on public.device_pairing_requests for select
  to authenticated
  using (auth.uid() = owner_id);

create policy "device_pairing_requests_insert_own"
  on public.device_pairing_requests for insert
  to authenticated
  with check (auth.uid() = owner_id);

create policy "device_pairing_requests_update_own"
  on public.device_pairing_requests for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "device_pairing_requests_delete_own"
  on public.device_pairing_requests for delete
  to authenticated
  using (auth.uid() = owner_id);

comment on table public.device_pairing_requests is
  'FASE 13 --- tramite cieco per il pairing via QR tra i dispositivi dello stesso account: mai il Master Key in chiaro né una chiave capace di derivarlo da sola, solo chiavi pubbliche effimere e un payload già cifrato.';

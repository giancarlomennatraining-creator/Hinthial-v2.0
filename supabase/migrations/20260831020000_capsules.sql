-- FASE 8 --- Capsule digitali v1.
--
-- Prima versione molto semplice (HINTHIAL_MVP.md sezione 8): titolo,
-- contenuto e metadati degli allegati vivono insieme in un unico
-- encrypted_payload (JSON, cifrato con la Master Key) --- coerente con
-- l'entità Capsule di sezione 5, che ha un solo campo cifrato, non uno
-- per campo come documents/assets/reminders. Il contenuto vero e proprio
-- degli allegati (i byte del file) è cifrato separatamente (stessa
-- Document Key per-file di FASE 4) e vive in un bucket Storage dedicato,
-- a un path deterministico (owner_id/capsule_id/attachment_id.json) ---
-- non serve una colonna storage_path in chiaro.
--
-- "condizione" (access_condition) per l'MVP è manuale soltanto: un solo
-- valore ammesso, pensato per essere ampliato (constraint allargato,
-- come già fatto per audit_events.event_type) quando arriverà il Dead
-- Man's Switch (FASE 13) --- non implementato qui, per esplicita
-- indicazione della spec.
--
-- "destinatario" collega la capsula a un contatto fiduciario (FASE 7):
-- nessuno sblocco automatico dei dati avviene qui --- "Condividi" è
-- solo un cambio di stato registrato (bozza -> pronta -> condivisa).

create table public.capsules (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  -- Serialized EncryptedEnvelope: JSON { title, content, attachments: [...] },
  -- encrypted with the Master Key.
  encrypted_payload text not null,
  related_contact_id uuid references public.trusted_contacts (id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'ready', 'shared')),
  access_condition text not null default 'manual' check (access_condition in ('manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.capsules is
  'Capsule per HINTHIAL_MVP.md sezione 5 (FASE 8). Titolo/contenuto/metadati allegati in un unico encrypted_payload. Nessuno sblocco automatico dei dati in questa fase.';

create index capsules_owner_id_created_at_idx
  on public.capsules (owner_id, created_at desc);

alter table public.capsules enable row level security;

create policy "capsules_select_own"
  on public.capsules for select
  to authenticated
  using (auth.uid() = owner_id);

create policy "capsules_insert_own"
  on public.capsules for insert
  to authenticated
  with check (auth.uid() = owner_id);

create policy "capsules_update_own"
  on public.capsules for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "capsules_delete_own"
  on public.capsules for delete
  to authenticated
  using (auth.uid() = owner_id);

create trigger capsules_set_updated_at
  before update on public.capsules
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Storage: private bucket for encrypted capsule attachment payloads
-- ---------------------------------------------------------------------
-- Object path convention: {owner_id}/{capsule_id}/{attachment_id}.json
-- (a serialized EncryptedEnvelope, same shape as encrypted-documents).

insert into storage.buckets (id, name, public)
values ('encrypted-capsules', 'encrypted-capsules', false);

create policy "encrypted_capsules_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'encrypted-capsules'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "encrypted_capsules_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'encrypted-capsules'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "encrypted_capsules_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'encrypted-capsules'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

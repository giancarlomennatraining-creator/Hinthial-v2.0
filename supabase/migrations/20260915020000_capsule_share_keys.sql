-- FASE C1 --- il vero sblocco del contenuto per chi riceve una capsula
-- condivisa (v. src/lib/crypto/keypair.ts per lo schema completo).
-- Tabella a sé, non nuove colonne su capsule_shares apposta: le regole
-- di riga (RLS) di Postgres si applicano a intere righe, non a singole
-- colonne --- per negare la lettura della chiave/del contenuto cifrato
-- per il destinatario finché open_at non è arrivata, serve una riga
-- che possa restare invisibile da sola, non una colonna in più su una
-- riga (capsule_shares) già visibile per i soli metadati.

create table public.capsule_share_keys (
  id uuid primary key default gen_random_uuid(),
  capsule_id uuid not null references public.capsules (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  recipient_user_id uuid not null references auth.users (id) on delete cascade,
  -- Chiave pubblica ECDH effimera (JWK, JSON) generata dal proprietario
  -- per QUESTA condivisione --- in chiaro, serve al destinatario per
  -- ridrivare la stessa chiave condivisa con la propria privata.
  ephemeral_public_key text not null,
  -- Titolo/contenuto/allegati della capsula, cifrati con la chiave
  -- condivisa (mai con la Master Key del proprietario, che il
  -- destinatario non ha): ogni allegato porta qui dentro la propria
  -- Document Key in chiaro (protetta comunque da questo stesso
  -- involucro cifrato) --- niente doppio wrapping, una sola busta basta.
  encrypted_payload_for_recipient text not null,
  created_at timestamptz not null default now(),
  unique (capsule_id, recipient_user_id)
);

comment on table public.capsule_share_keys is 'FASE C1 --- una copia del contenuto di una capsula, cifrata appositamente per un destinatario (scambio di chiavi ECDH), leggibile da lui solo dopo la data di apertura della capsula. owner_id/recipient_user_id qui duplicano capsule_shares di proposito (stesso schema): niente join necessario per le regole di accesso qui sotto.';

create index capsule_share_keys_recipient_idx on public.capsule_share_keys (recipient_user_id);

alter table public.capsule_share_keys enable row level security;

create policy "capsule_share_keys_select_owner"
  on public.capsule_share_keys for select
  to authenticated
  using (auth.uid() = owner_id);

create policy "capsule_share_keys_insert_owner"
  on public.capsule_share_keys for insert
  to authenticated
  with check (auth.uid() = owner_id);

create policy "capsule_share_keys_update_owner"
  on public.capsule_share_keys for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "capsule_share_keys_delete_owner"
  on public.capsule_share_keys for delete
  to authenticated
  using (auth.uid() = owner_id);

-- Il cuore della regola: il destinatario vede questa riga solo se
-- open_at è già passata --- non basta essere il destinatario giusto,
-- serve anche che sia già il momento giusto. Verificato qui, non solo
-- nell'interfaccia: chi scavalcasse l'app chiamando l'API direttamente
-- otterrebbe comunque nessuna riga prima di allora.
create policy "capsule_share_keys_select_recipient_after_open"
  on public.capsule_share_keys for select
  to authenticated
  using (
    auth.uid() = recipient_user_id
    and exists (
      select 1 from public.capsules c
      where c.id = capsule_share_keys.capsule_id
        and c.open_at is not null
        and c.open_at <= now()
    )
  );

-- ---------------------------------------------------------------------
-- Storage: il destinatario può scaricare i blob cifrati degli allegati
-- di una capsula condivisa con lui --- stessa condizione (dopo open_at)
-- verificata anche qui, non solo per la riga che ne descrive le chiavi:
-- l'allegato in sé non serve a nulla senza la Document Key contenuta in
-- capsule_share_keys, ma è comunque più corretto negarne l'accesso allo
-- stesso momento, non prima.
-- ---------------------------------------------------------------------
create policy "encrypted_capsules_select_shared_recipient"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'encrypted-capsules'
    and exists (
      select 1 from public.capsule_shares cs
      join public.capsules c on c.id = cs.capsule_id
      where cs.recipient_user_id = auth.uid()
        and c.owner_id::text = (storage.foldername(name))[1]
        and c.id::text = (storage.foldername(name))[2]
        and c.open_at is not null
        and c.open_at <= now()
    )
  );

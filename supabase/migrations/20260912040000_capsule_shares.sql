-- FASE B del piano di condivisione capsule: "Condivise con me" ---
-- l'involucro, non ancora lo sblocco del contenuto (arriverà con la
-- Fase C1, lo scambio di chiavi). Questa tabella collega una capsula
-- già chiusa/condivisa a un destinatario reale (v. friends.linked_user_id,
-- migrazione friend_account_lookup) --- non concede alcun accesso al
-- contenuto cifrato: solo metadati già in chiaro (chi l'ha mandata,
-- quando, quando si apre) diventano visibili al destinatario.

create table public.capsule_shares (
  id uuid primary key default gen_random_uuid(),
  capsule_id uuid not null references public.capsules (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  recipient_user_id uuid not null references auth.users (id) on delete cascade,
  shared_at timestamptz not null default now(),
  unique (capsule_id, recipient_user_id)
);

comment on table public.capsule_shares is
  'FASE B --- collega una capsula (capsule_id, owner_id) a un destinatario reale (recipient_user_id). Creata quando il proprietario condivide una capsula con un amico già collegato a un account, o retroattivamente quando un amico si collega dopo che una capsula era già stata condivisa con lui. Nessun accesso al contenuto cifrato --- solo il collegamento e i metadati in chiaro necessari a "Condivise con me".';

create index capsule_shares_recipient_idx on public.capsule_shares (recipient_user_id, shared_at desc);

alter table public.capsule_shares enable row level security;

-- Il proprietario gestisce le proprie condivisioni.
create policy "capsule_shares_select_owner"
  on public.capsule_shares for select
  to authenticated
  using (auth.uid() = owner_id);

create policy "capsule_shares_insert_owner"
  on public.capsule_shares for insert
  to authenticated
  with check (auth.uid() = owner_id);

create policy "capsule_shares_delete_owner"
  on public.capsule_shares for delete
  to authenticated
  using (auth.uid() = owner_id);

-- Il destinatario vede le proprie righe --- è così che "Condivise con
-- me" sa quali capsule cercare.
create policy "capsule_shares_select_recipient"
  on public.capsule_shares for select
  to authenticated
  using (auth.uid() = recipient_user_id);

-- ---------------------------------------------------------------------
-- Il destinatario deve poter leggere status/open_at/created_at della
-- capsula condivisa (encrypted_payload compreso: resta comunque
-- cifrato con la Master Key del proprietario, illeggibile per lui
-- quanto lo è già per il server --- nessuna fuga di riservatezza a
-- concedergli la riga intera). E il nome del mittente, per mostrare
-- "Da: ...".
-- ---------------------------------------------------------------------
create policy "capsules_select_shared_recipient"
  on public.capsules for select
  to authenticated
  using (exists (
    select 1 from public.capsule_shares cs
    where cs.capsule_id = capsules.id and cs.recipient_user_id = auth.uid()
  ));

create policy "profiles_select_shared_by_owner"
  on public.profiles for select
  to authenticated
  using (exists (
    select 1 from public.capsule_shares cs
    where cs.owner_id = profiles.id and cs.recipient_user_id = auth.uid()
  ));

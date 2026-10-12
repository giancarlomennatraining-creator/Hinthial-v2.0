-- "Lascia un pensiero": chi riceve una capsula, una volta aperta, può scrivere due righe a chi l'ha lasciata. Il pensiero è
-- cifrato SUL DISPOSITIVO di chi lo scrive per la chiave pubblica del proprietario (stesso scambio ECDH delle capsule, in
-- senso inverso, v. src/lib/crypto/keypair.ts): il server vede solo un testo cifrato che non può leggere, e nemmeno chi l'ha
-- scritto può rileggerlo dopo (la chiave effimera non viene conservata). Solo il proprietario lo decifra, con la sua Master Key.

create table public.capsule_replies (
  id uuid primary key default gen_random_uuid(),
  capsule_id uuid not null references public.capsules (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  author_id uuid not null references auth.users (id) on delete cascade,
  -- Chiave pubblica ECDH effimera (JWK, JSON) generata da chi scrive per QUESTO pensiero --- in chiaro, serve al
  -- proprietario per ridrivare la stessa chiave condivisa con la propria privata.
  ephemeral_public_key text not null,
  -- Nome di chi scrive, testo e data, cifrati con la chiave condivisa.
  encrypted_payload text not null check (length(encrypted_payload) <= 12000),
  created_at timestamptz not null default now(),
  -- Un pensiero a testa per capsula: chi vuole cambiarlo lo ritira e ne scrive un altro.
  unique (capsule_id, author_id)
);

comment on table public.capsule_replies is
  'Un pensiero lasciato da un destinatario al proprietario di una capsula già aperta. Il contenuto (nome, testo, data) è cifrato per la chiave pubblica del proprietario: il server non lo legge.';

create index capsule_replies_owner_idx on public.capsule_replies (owner_id, created_at desc);

alter table public.capsule_replies enable row level security;

-- Il proprietario legge i pensieri ricevuti; chi li ha scritti sa solo di averlo fatto (non può decifrarli).
create policy "capsule_replies_select_owner_or_author"
  on public.capsule_replies for select
  to authenticated
  using (auth.uid() = owner_id or auth.uid() = author_id);

-- Si scrive solo se si è un destinatario che può già leggere la capsula: la sotto-query su capsule_share_keys è soggetta alle
-- regole di quella tabella, che nega la riga prima della data di apertura (o dell'eredità digitale). Chi scavalca l'app e chiama
-- l'API direttamente ottiene lo stesso rifiuto.
create policy "capsule_replies_insert_recipient"
  on public.capsule_replies for insert
  to authenticated
  with check (
    auth.uid() = author_id
    and exists (
      select 1 from public.capsule_share_keys k
      where k.capsule_id = capsule_replies.capsule_id
        and k.owner_id = capsule_replies.owner_id
        and k.recipient_user_id = auth.uid()
    )
  );

-- Lo ritira chi l'ha scritto; il proprietario può toglierlo dalla propria raccolta.
create policy "capsule_replies_delete_owner_or_author"
  on public.capsule_replies for delete
  to authenticated
  using (auth.uid() = owner_id or auth.uid() = author_id);

-- ---------------------------------------------------------------------
-- get_capsule_owner_public_key: la chiave pubblica di chi ha lasciato una capsula, per cifrargli il pensiero. Serve perché chi
-- riceve non ha (necessariamente) il proprietario tra gli amici: get_linked_friend_public_key parte da una riga friends. Vale
-- solo per chi è davvero destinatario della capsula, e restituisce soltanto la chiave pubblica (pubblica per definizione),
-- mai altro della riga encryption_setup.
-- ---------------------------------------------------------------------
create or replace function public.get_capsule_owner_public_key(p_capsule_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select es.public_key
  from public.capsule_shares cs
  join public.encryption_setup es on es.owner_id = cs.owner_id
  where cs.capsule_id = p_capsule_id
    and cs.recipient_user_id = auth.uid();
$$;

comment on function public.get_capsule_owner_public_key(uuid) is
  'Chiave pubblica ECDH di chi ha lasciato la capsula, o null --- solo per un suo destinatario. Mai altro della riga encryption_setup.';

revoke all on function public.get_capsule_owner_public_key(uuid) from public;
grant execute on function public.get_capsule_owner_public_key(uuid) to authenticated;

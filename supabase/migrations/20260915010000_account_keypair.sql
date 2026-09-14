-- FASE C1 --- lo scambio di chiavi che permette a un destinatario di
-- decifrare davvero una capsula condivisa con lui (v. src/lib/crypto/
-- keypair.ts). Ogni account guadagna una coppia di chiavi ECDH: la
-- pubblica qui in chiaro (è pubblica per definizione), la privata
-- cifrata dalla propria Master Key --- stesso principio già usato per
-- una Document Key, non un'eccezione allo zero-knowledge.

alter table public.encryption_setup
  add column public_key text,
  add column wrapped_private_key text;

comment on column public.encryption_setup.public_key is 'Chiave pubblica ECDH (JWK, JSON) di questo account --- in chiaro apposta, serve ad altri account per condividere una capsula con questo. Null per gli account creati prima di questa fase, finché non si sblocca almeno una volta (v. MasterKeyProvider, generazione pigra).';
comment on column public.encryption_setup.wrapped_private_key is 'Chiave privata ECDH (JWK, JSON), cifrata dalla Master Key di questo account --- mai altrimenti in chiaro, nemmeno per il server.';

-- Serviva anche per un futuro cambio della master password (oggi non
-- implementato) --- qui serve per il "sanamento pigro" della coppia di
-- chiavi per un account creato prima di questa fase (v. sopra): finora
-- questa tabella non aveva alcuna policy di update, di proposito
-- ("il setup avviene una volta sola").
create policy "encryption_setup_update_own"
  on public.encryption_setup for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- ---------------------------------------------------------------------
-- get_linked_friend_public_key: la chiave pubblica dell'account
-- collegato a un amico (v. friends.linked_user_id) --- mai il resto
-- della sua riga encryption_setup (che contiene anche la Master Key
-- cifrata dalla sua password: inutile senza quella password, ma
-- comunque meglio non esporla mai a nessun altro account). Stesso
-- schema di get_linked_friend_avatar_path. Il chiamante deve possedere
-- la riga friends indicata.
-- ---------------------------------------------------------------------
create or replace function public.get_linked_friend_public_key(p_friend_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_linked_user_id uuid;
  v_public_key text;
begin
  select linked_user_id into v_linked_user_id
  from public.friends
  where id = p_friend_id and owner_id = auth.uid();

  if v_linked_user_id is null then
    return null;
  end if;

  select public_key into v_public_key
  from public.encryption_setup
  where owner_id = v_linked_user_id;

  return v_public_key;
end;
$$;

comment on function public.get_linked_friend_public_key(uuid) is 'Chiave pubblica ECDH dell''account collegato a un amico, o null --- mai altro della sua riga encryption_setup. Il chiamante deve possedere la riga friends indicata.';

revoke all on function public.get_linked_friend_public_key(uuid) from public;
grant execute on function public.get_linked_friend_public_key(uuid) to authenticated;

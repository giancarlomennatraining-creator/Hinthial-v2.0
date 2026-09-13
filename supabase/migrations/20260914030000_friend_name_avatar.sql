-- "Nome" diventa concettualmente "Nome visualizzato" (nessun cambiamento
-- di schema per lui: resta encrypted_name, solo l'etichetta in
-- interfaccia cambia) --- e si aggiungono Nome e Cognome come campi a
-- sé, cifrati come encrypted_name/encrypted_email (v.
-- domain/friends/repository.ts). Nullable: gli amici già esistenti non
-- li hanno --- non c'è nulla da "sanare" qui, a differenza di
-- capsules.open_at, dato che non servono a nessuna logica server-side.
alter table public.friends
  add column encrypted_first_name text,
  add column encrypted_last_name text;

comment on column public.friends.encrypted_first_name is 'Nome dell''amico, cifrato come encrypted_name/encrypted_email --- null per gli amici creati prima che questo campo esistesse.';
comment on column public.friends.encrypted_last_name is 'Cognome dell''amico, cifrato --- v. encrypted_first_name.';

-- Foto di un amico, caricata a mano dal proprietario --- in chiaro,
-- stesso principio già accettato per l'avatar del proprio profilo (v.
-- 20260902000000_profile_avatar.sql): resta nello stesso bucket
-- pubblico "avatars", sotto la cartella {owner_id}/... di chi la
-- carica, quindi le policy di Storage esistenti bastano già, nessuna
-- nuova regola necessaria qui.
alter table public.friends
  add column avatar_path text;

comment on column public.friends.avatar_path is 'Path nel bucket Storage "avatars" (pubblico, in chiaro) per una foto caricata a mano dal proprietario, o null. Se l''amico è un account Hinthial collegato (linked_user_id) e non è stata caricata una foto qui, l''interfaccia mostra invece la sua foto reale (v. get_linked_friend_avatar_path sotto) --- mai il contrario: una foto caricata a mano vince sempre su quella reale.';

-- Path dell'avatar dell'account Hinthial collegato a un amico (se c'è),
-- senza esporre il resto della sua riga profiles --- che nel tempo si è
-- riempita di parecchie colonne non pertinenti (preferenze di vista,
-- consensi IA, data di nascita, ...). Chi ha semplicemente aggiunto
-- un'email come amico (nessuna conferma richiesta dall'altra parte, a
-- differenza di una capsula condivisa) non deve poter leggere altro.
-- SECURITY DEFINER --- stesso schema di lookup_friend_account.
create or replace function public.get_linked_friend_avatar_path(p_friend_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_linked_user_id uuid;
  v_avatar_path text;
begin
  select linked_user_id into v_linked_user_id
  from public.friends
  where id = p_friend_id and owner_id = auth.uid();

  if v_linked_user_id is null then
    return null;
  end if;

  select avatar_path into v_avatar_path
  from public.profiles
  where id = v_linked_user_id;

  return v_avatar_path;
end;
$$;

comment on function public.get_linked_friend_avatar_path(uuid) is 'Path Storage (bucket pubblico "avatars") della foto profilo reale di un amico collegato a un account Hinthial, o null --- mai altro della sua riga profiles. Il chiamante deve possedere la riga friends indicata.';

revoke all on function public.get_linked_friend_avatar_path(uuid) from public;
grant execute on function public.get_linked_friend_avatar_path(uuid) to authenticated;

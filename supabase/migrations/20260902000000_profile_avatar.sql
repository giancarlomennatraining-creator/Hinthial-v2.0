-- Foto profilo: in chiaro, come nome/cognome --- non è contenuto
-- sensibile come un documento, stesso principio già accettato per
-- first_name/last_name in profiles.
--
-- Il bucket è pubblico apposta: il path è {owner_id}/avatar.{ext}, un
-- UUID non enumerabile --- stesso compromesso già accettato per il nome
-- in chiaro. Evita di dover gestire URL firmate/scadenza solo per
-- un'immagine mostrata su ogni pagina dell'app (il menu utente). Nessun
-- contenuto del vault passa da qui: resta tutto nel bucket privato
-- encrypted-documents.

alter table public.profiles
  add column avatar_path text;

comment on column public.profiles.avatar_path is
  'Path nel bucket Storage "avatars" (pubblico, in chiaro), o null se non impostata.';

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true);

create policy "avatars_select_public"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

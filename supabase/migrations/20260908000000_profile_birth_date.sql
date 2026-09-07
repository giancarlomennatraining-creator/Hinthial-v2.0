-- Modifica: data di nascita nel profilo --- raccolta alla registrazione
-- e modificabile in Impostazioni > Informazioni utente. Non è un dato
-- del vault, vive in chiaro come nome/cognome (stesso principio già
-- accettato per quelli: non è sensibile come il contenuto di un
-- documento). Nullable: gli account già esistenti non ce l'hanno, e
-- resta facoltativa anche per chi si registra da ora in poi finché non
-- la valorizza.
alter table public.profiles
  add column birth_date date;

comment on column public.profiles.birth_date is 'Data di nascita, in chiaro (dato anagrafico, non del vault). Facoltativa.';

-- Il trigger di creazione profilo legge anche birth_date dai metadata
-- della registrazione, se presente.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, last_name, birth_date)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'first_name', ''), split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    nullif(new.raw_user_meta_data ->> 'birth_date', '')::date
  );

  perform public.seed_default_categories(new.id);

  return new;
end;
$$;

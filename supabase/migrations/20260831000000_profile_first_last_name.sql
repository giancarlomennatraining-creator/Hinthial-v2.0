-- Modifica: separare il nome utente in "Nome" e "Cognome" (due colonne
-- distinte), invece di un'unica display_name --- sia nel form di
-- registrazione sia nello storage.

alter table public.profiles
  add column first_name text,
  add column last_name text;

-- Backfill best-effort per eventuali righe esistenti: la prima parola
-- diventa first_name, il resto (se presente) last_name.
update public.profiles
set
  first_name = split_part(display_name, ' ', 1),
  last_name = case
    when position(' ' in display_name) > 0
      then trim(substring(display_name from position(' ' in display_name) + 1))
    else ''
  end
where first_name is null;

alter table public.profiles
  alter column first_name set not null,
  alter column last_name set not null,
  drop column display_name;

comment on column public.profiles.first_name is 'Nome (given name).';
comment on column public.profiles.last_name is 'Cognome (family name).';

-- Il trigger di creazione profilo legge ora first_name/last_name dai
-- metadata della registrazione, invece di un'unica display_name.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, last_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'first_name', ''), split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'last_name', '')
  );

  perform public.seed_default_categories(new.id);

  return new;
end;
$$;

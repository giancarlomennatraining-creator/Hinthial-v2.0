-- FASE A del piano di condivisione capsule: riconoscere quali amici
-- hanno già un account Hinthial registrato --- prerequisito per
-- "Condivise con me" e per lo scambio di chiavi che verrà dopo.
--
-- Il nome/l'email di un amico sono cifrati con la Master Key di chi lo
-- ha aggiunto: il server non può confrontarli da sé con gli account
-- registrati. La soluzione è una funzione mirata (stesso principio di
-- log_failed_login_attempt, v. migrazione audit_events_expansion): il
-- client, dopo aver decifrato l'email di UN amico alla volta, chiede
-- "questa email corrisponde a un account?" --- mai un elenco, mai un
-- confronto bulk.
--
-- A differenza di log_failed_login_attempt, qui rivelare la
-- corrispondenza è proprio lo scopo (non un effetto collaterale da
-- evitare) --- il che apre la porta a usarla per enumerare account
-- registrati provando email a caso. Mitigazione: un tetto di chiamate
-- al giorno per chi chiama, generoso per l'uso normale (ricontrollare
-- i propri amici) ma che rende poco pratico un abuso su scala.

alter table public.friends
  add column linked_user_id uuid references auth.users (id) on delete set null;

comment on column public.friends.linked_user_id is
  'Se questo amico ha un account Hinthial con la stessa email, il suo id --- risolto lato client via lookup_friend_account() e salvato qui. Null finché non risolto o se non corrisponde a nessun account.';

-- ---------------------------------------------------------------------
-- friend_lookup_attempts: contatore giornaliero per chiamante, unico
-- scopo di questa tabella --- mai letta/scritta direttamente dal
-- client, solo dalla funzione qui sotto (RLS abilitata, nessuna
-- policy: negato di default a chiunque non abbia bypass da
-- SECURITY DEFINER).
-- ---------------------------------------------------------------------
create table public.friend_lookup_attempts (
  caller_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  count integer not null default 0,
  primary key (caller_id, day)
);

comment on table public.friend_lookup_attempts is
  'Contatore giornaliero di verifiche email->account per chiamante (v. lookup_friend_account) --- mitiga l''enumerazione di account registrati. Mai esposta al client.';

alter table public.friend_lookup_attempts enable row level security;

-- ---------------------------------------------------------------------
-- lookup_friend_account: verifica una singola email candidata contro
-- gli account registrati --- restituisce id e nome visualizzato solo se
-- corrisponde, altrimenti nessuna riga. Oltre 200 chiamate/giorno per lo
-- stesso chiamante, solleva un errore invece di rispondere.
-- ---------------------------------------------------------------------
create or replace function public.lookup_friend_account(target_email text)
returns table(matched_user_id uuid, matched_display_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  attempts int;
begin
  if caller is null then
    raise exception 'Non autenticato.';
  end if;

  insert into public.friend_lookup_attempts (caller_id, day, count)
  values (caller, current_date, 1)
  on conflict (caller_id, day) do update set count = friend_lookup_attempts.count + 1
  returning count into attempts;

  if attempts > 200 then
    raise exception 'Troppe verifiche oggi. Riprova domani.';
  end if;

  return query
    select u.id, trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, ''))
    from auth.users u
    join public.profiles p on p.id = u.id
    where lower(u.email) = lower(trim(target_email))
    limit 1;
end;
$$;

revoke all on function public.lookup_friend_account(text) from public;
grant execute on function public.lookup_friend_account(text) to authenticated;

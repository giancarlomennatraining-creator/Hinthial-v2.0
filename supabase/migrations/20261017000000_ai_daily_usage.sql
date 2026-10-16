-- Tetto giornaliero alle chiamate a Claude, per utente (v. src/lib/ai/daily-quota.ts). La chiave Anthropic è una sola
-- e la paga chi gestisce Hinthial: senza un tetto, un utente con Hinthia attiva potrebbe chiamare Claude senza limite.
--
-- Si conta una riga per utente e per giorno (il giorno di Roma, così il tetto si azzera a mezzanotte italiana). Gli
-- utenti possono solo leggere la propria riga (per vedere quante richieste restano); scrivere passa solo dalla funzione
-- qui sotto, che il server chiama prima di ogni richiesta a Claude. Migrazione additiva: niente di esistente cambia.

create table public.ai_daily_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  calls integer not null default 0 check (calls >= 0),
  primary key (user_id, day)
);

alter table public.ai_daily_usage enable row level security;

create policy "ai_daily_usage_select_own"
  on public.ai_daily_usage for select to authenticated
  using (auth.uid() = user_id);

-- Consuma una chiamata per l'utente collegato, se oggi è ancora sotto `daily_limit`. In un solo passo (insert ... on
-- conflict ... where), così due richieste contemporanee non possono superare il tetto insieme.
-- Restituisce le chiamate usate oggi dopo questa, oppure -1 se il tetto era già raggiunto (niente viene contato).
create or replace function public.consume_ai_call(daily_limit integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'Europe/Rome')::date;
  used integer;
begin
  if auth.uid() is null then
    raise exception 'consume_ai_call: utente non autenticato';
  end if;
  if daily_limit is null or daily_limit < 1 then
    return -1;
  end if;

  insert into public.ai_daily_usage as usage (user_id, day, calls)
  values (auth.uid(), today, 1)
  on conflict (user_id, day) do update
    set calls = usage.calls + 1
    where usage.calls < daily_limit
  returning usage.calls into used;

  return coalesce(used, -1);
end;
$$;

revoke all on function public.consume_ai_call(integer) from public;
grant execute on function public.consume_ai_call(integer) to authenticated;

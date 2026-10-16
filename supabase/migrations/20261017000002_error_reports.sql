-- Gli errori di Hinthial in produzione (v. src/lib/errors/), per saperlo prima che lo dica un utente. Una riga per tipo di
-- errore e per giorno: lo stesso errore ripetuto aumenta `count`, non crea righe nuove. Ogni giorno il cron manda
-- un'email con gli errori non ancora segnalati (notified_at nullo) e li segna.
--
-- Niente contenuti né dati delle persone: tipo, messaggio ripulito (niente email, id, numeri lunghi), percorso senza
-- parametri, codice dell'errore e browser. Nessun user_id: per capire cosa si rompe non serve sapere a chi.
--
-- Gli utenti non leggono e non scrivono questa tabella: RLS attiva senza policy. Scrive solo il server, col service
-- role, attraverso la funzione qui sotto. Migrazione additiva.

create table public.error_reports (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null,
  day date not null,
  source text not null check (source in ('server', 'client', 'csp')),
  kind text not null,
  message text not null,
  path text,
  digest text,
  user_agent text,
  count integer not null default 1 check (count >= 1),
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  notified_at timestamptz,
  unique (fingerprint, day)
);

create index error_reports_unnotified_idx on public.error_reports (first_seen) where notified_at is null;

alter table public.error_reports enable row level security;

-- Registra un errore: se oggi c'è già, conta una volta in più; se è nuovo, lo inserisce, ma solo fino a 1000 errori
-- diversi al giorno, così la tabella non può crescere senza limite anche se qualcuno manda segnalazioni a raffica.
create or replace function public.record_error_report(
  p_fingerprint text,
  p_source text,
  p_kind text,
  p_message text,
  p_path text,
  p_digest text,
  p_user_agent text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'Europe/Rome')::date;
begin
  update public.error_reports
    set count = count + 1, last_seen = now()
    where fingerprint = p_fingerprint and day = today;
  if found then
    return;
  end if;

  if (select count(*) from public.error_reports where day = today) >= 1000 then
    return;
  end if;

  insert into public.error_reports (fingerprint, day, source, kind, message, path, digest, user_agent)
  values (p_fingerprint, today, p_source, left(p_kind, 120), left(p_message, 500), left(p_path, 300), left(p_digest, 120), left(p_user_agent, 300))
  on conflict (fingerprint, day) do update
    set count = public.error_reports.count + 1, last_seen = now();
end;
$$;

revoke all on function public.record_error_report(text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.record_error_report(text, text, text, text, text, text, text) to service_role;

-- Spazio per utente (v. src/lib/storage/quota.ts). Lo storage lo paga chi gestisce Hinthial: senza un tetto, un solo
-- utente potrebbe riempirlo. Il tetto vale per i file cifrati che una persona carica (documenti, allegati delle capsule,
-- copie dei fascicoli condivisi, foto del profilo): tutti stanno sotto una cartella che ha per nome l'id dell'utente.
--
-- Migrazione additiva: le policy esistenti non cambiano. Se ne aggiunge una RESTRITTIVA sull'inserimento, che si somma
-- a quelle: oltre il tetto non si carica più nulla, anche scavalcando l'app. Il service role (cron, cancellazioni) non
-- ne è toccato. Il tetto di tutti si cambia riscrivendo storage_quota_bytes(); quello di una persona, con una riga in
-- storage_quota_overrides.

-- Eccezioni per singolo utente: più spazio a chi ne ha bisogno, o un tetto minuscolo per i test. Solo il service role la
-- scrive (dal pannello di Supabase o da uno script): nessuna policy di scrittura per gli utenti, che leggono solo la loro.
create table public.storage_quota_overrides (
  user_id uuid primary key references auth.users (id) on delete cascade,
  quota_bytes bigint not null check (quota_bytes >= 0),
  note text,
  created_at timestamptz not null default now()
);

alter table public.storage_quota_overrides enable row level security;

create policy "storage_quota_overrides_select_own"
  on public.storage_quota_overrides for select to authenticated
  using (auth.uid() = user_id);

-- Il tetto dell'utente collegato: la sua eccezione se c'è, altrimenti 2 GiB di file cifrati (un file cifrato occupa
-- circa un terzo in più dell'originale).
create or replace function public.storage_quota_bytes()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select q.quota_bytes from public.storage_quota_overrides q where q.user_id = auth.uid()),
    2147483648::bigint
  )
$$;

revoke all on function public.storage_quota_bytes() from public;
grant execute on function public.storage_quota_bytes() to authenticated;

-- Lo spazio occupato dall'utente collegato. Security definer: legge storage.objects anche dove le policy di lettura non
-- arrivano, ma solo per l'utente stesso (auth.uid()), mai per un altro.
create or replace function public.storage_used_bytes()
returns bigint
language sql
stable
security definer
set search_path = public, storage
as $$
  select coalesce(sum((o.metadata ->> 'size')::bigint), 0)::bigint
  from storage.objects o
  where auth.uid() is not null
    and o.bucket_id in ('encrypted-documents', 'encrypted-capsules', 'dossier-shares', 'avatars')
    and o.name like auth.uid()::text || '/%'
$$;

revoke all on function public.storage_used_bytes() from public;
grant execute on function public.storage_used_bytes() to authenticated;

-- Per l'app: spazio usato e tetto in una sola chiamata (Impostazioni, e il controllo prima di caricare).
create or replace function public.my_storage_usage()
returns table (used_bytes bigint, quota_bytes bigint)
language sql
stable
security definer
set search_path = public
as $$
  select public.storage_used_bytes(), public.storage_quota_bytes()
$$;

revoke all on function public.my_storage_usage() from public;
grant execute on function public.my_storage_usage() to authenticated;

-- Oltre il tetto non si caricano nuovi file. Restano permessi la foto del profilo (piccola, una sola) e i dati derivati
-- di un documento già caricato (miniatura e pagine lette), che si rigenerano con "Rileggi": bloccarli romperebbe
-- documenti che ci sono già, senza liberare nulla. Si può sforare di un solo file, al massimo: il controllo guarda lo
-- spazio usato prima del caricamento.
create policy "storage_quota_insert"
  on storage.objects
  as restrictive
  for insert
  to authenticated
  with check (
    bucket_id not in ('encrypted-documents', 'encrypted-capsules', 'dossier-shares')
    or name like '%-thumb.json'
    or name like '%-segments.json'
    or public.storage_used_bytes() < public.storage_quota_bytes()
  );

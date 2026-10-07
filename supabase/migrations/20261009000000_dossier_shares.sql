-- Condividere un fascicolo con un professionista (notaio, medico, commercialista...) con un link protetto.
--
-- Come funziona, e cosa vede il server:
--   * Chi condivide sceglie i documenti. Il suo dispositivo li decifra, li ricifra con una chiave NUOVA scelta a caso
--     (la chiave di condivisione) e carica le copie cifrate in un bucket privato. Questa chiave sta SOLO nel link, dopo il
--     simbolo #, che il browser non invia mai al server: chi non ha il link intero non legge niente, nemmeno noi.
--   * Un indice cifrato con la stessa chiave (titolo, elenco dei documenti, eventuale riassunto) sta in
--     encrypted_manifest. La chiave, cifrata con la Master Key, sta anche in encrypted_link_key: serve solo a chi ha
--     condiviso, per ricopiare il link in seguito.
--   * Chi riceve il link non ha un account: le pagine pubbliche passano dal server (service role), che controlla solo che
--     il link non sia scaduto né revocato e consegna byte cifrati.
-- In chiaro restano la scadenza, se si può scaricare, quanti documenti, lo stato e gli accessi: lo stesso livello di
-- dettaglio che il server ha già su una scadenza o su un documento.
-- Additiva: due tabelle e un bucket nuovi, nessun dato esistente toccato.

create table public.dossier_shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  dossier_id uuid not null references public.dossiers(id) on delete cascade,
  -- Per chi è il link ("Notaio Rossi"), cifrato con la Master Key come ogni testo dell'utente.
  encrypted_label text,
  encrypted_link_key text not null,
  encrypted_manifest text not null,
  allow_download boolean not null default false,
  document_count int not null check (document_count >= 0),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  -- Quando le copie cifrate sono state tolte dal bucket (revoca, scadenza, eliminazione): null finché ci sono.
  files_purged_at timestamptz,
  created_at timestamptz not null default now()
);

create index dossier_shares_owner_id_idx on public.dossier_shares (owner_id, created_at desc);
create index dossier_shares_dossier_id_idx on public.dossier_shares (dossier_id);
create index dossier_shares_to_purge_idx on public.dossier_shares (expires_at) where files_purged_at is null;

alter table public.dossier_shares enable row level security;

create policy "dossier_shares_select_own"
  on public.dossier_shares for select
  using (auth.uid() = owner_id);

-- Il fascicolo deve essere dell'utente stesso: senza questo controllo un id altrui, se indovinato, passerebbe.
create policy "dossier_shares_insert_own"
  on public.dossier_shares for insert
  with check (
    auth.uid() = owner_id
    and exists (select 1 from public.dossiers d where d.id = dossier_id and d.owner_id = auth.uid())
  );

create policy "dossier_shares_update_own"
  on public.dossier_shares for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "dossier_shares_delete_own"
  on public.dossier_shares for delete
  using (auth.uid() = owner_id);

-- Gli accessi li scrive solo il server (service role) quando qualcuno apre il link; chi ha condiviso li legge.
create table public.dossier_share_accesses (
  id uuid primary key default gen_random_uuid(),
  share_id uuid not null references public.dossier_shares(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  -- 'open' = ha aperto il link; 'document' = ha aperto un documento (document_id).
  kind text not null check (kind in ('open', 'document')),
  document_id uuid,
  accessed_at timestamptz not null default now()
);

create index dossier_share_accesses_share_id_idx on public.dossier_share_accesses (share_id, accessed_at desc);

alter table public.dossier_share_accesses enable row level security;

create policy "dossier_share_accesses_select_own"
  on public.dossier_share_accesses for select
  using (auth.uid() = owner_id);

-- Nessuna policy di insert/update/delete: gli accessi non si scrivono né si cambiano dal client.

-- ---------------------------------------------------------------------
-- Bucket privato per le copie cifrate con la chiave di condivisione.
-- Percorso: {owner_id}/{share_id}/{document_id}.json --- chi condivide scrive e toglie solo nella propria cartella;
-- chi riceve il link non ha accesso diretto: i file passano dal server.
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('dossier-shares', 'dossier-shares', false);

create policy "dossier_shares_files_select_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'dossier-shares'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "dossier_shares_files_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'dossier-shares'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "dossier_shares_files_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'dossier-shares'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

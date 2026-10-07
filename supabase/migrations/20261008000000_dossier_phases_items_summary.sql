-- Fascicoli: fasi, prossimi passi, persone coinvolte e riassunto scritto da Hinthia.
--
-- Tutto è facoltativo: un fascicolo senza fasi, passi, persone o riassunto resta com'è.
-- Il contenuto è cifrato sul dispositivo come titolo e descrizione: il server non legge nomi di fasi, testi dei passi,
-- nomi o ruoli delle persone, né il riassunto. In chiaro restano solo la spunta (done) e la data di un passo (due_on),
-- lo stesso livello di dettaglio di una scadenza.
-- Additiva: due colonne nullable e una tabella nuova, nessun dato esistente toccato.

alter table public.dossiers
  -- JSON cifrato { names: string[], current: number }: le tappe della vicenda e quella in cui si è.
  add column encrypted_phases text,
  -- JSON cifrato { text, generatedAt, documentCount }: il riassunto scritto da Hinthia (v. api/ai/dossier-summary).
  add column encrypted_summary text;

create table public.dossier_items (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossiers(id) on delete cascade,
  -- owner_id duplicato qui apposta, come in document_dossiers: regole di accesso senza join.
  owner_id uuid not null references auth.users(id) on delete cascade,
  -- 'step' = un prossimo passo (testo, data facoltativa, spunta); 'person' = una persona coinvolta (nome e ruolo).
  kind text not null check (kind in ('step', 'person')),
  encrypted_data text not null,
  due_on date,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create index dossier_items_dossier_id_idx on public.dossier_items (dossier_id);
create index dossier_items_owner_id_idx on public.dossier_items (owner_id);

alter table public.dossier_items enable row level security;

create policy "dossier_items_select_own"
  on public.dossier_items for select
  using (auth.uid() = owner_id);

-- Il fascicolo deve essere dell'utente stesso: senza questo controllo un id altrui, se indovinato, passerebbe.
create policy "dossier_items_insert_own"
  on public.dossier_items for insert
  with check (
    auth.uid() = owner_id
    and exists (select 1 from public.dossiers d where d.id = dossier_id and d.owner_id = auth.uid())
  );

create policy "dossier_items_update_own"
  on public.dossier_items for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "dossier_items_delete_own"
  on public.dossier_items for delete
  using (auth.uid() = owner_id);

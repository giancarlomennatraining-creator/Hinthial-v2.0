-- Documenti attesi di un fascicolo: una piccola lista di cose che mancano ("referto", "fattura", "ricevuta").
-- Ogni voce si spunta da sola quando nel fascicolo c'è un documento che la soddisfa (v. domain/dossiers/expected.ts),
-- oppure a mano.
--
-- L'etichetta è cifrata sul dispositivo come titolo e descrizione del fascicolo: dice cosa sta succedendo nella vita
-- dell'utente, quindi il server non la legge. Il resto (se è fatta, l'ordine) è in chiaro.
-- Additiva: una tabella nuova, nessun dato esistente toccato.

create table public.dossier_expected_items (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossiers(id) on delete cascade,
  -- owner_id duplicato qui apposta, come in document_dossiers: regole di accesso senza join.
  owner_id uuid not null references auth.users(id) on delete cascade,
  encrypted_label text not null,
  -- Spunta a mano, per un documento che non sta in Hinthial (es. "ritirare l'originale").
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create index dossier_expected_items_dossier_id_idx on public.dossier_expected_items (dossier_id);

alter table public.dossier_expected_items enable row level security;

create policy "dossier_expected_items_select_own"
  on public.dossier_expected_items for select
  using (auth.uid() = owner_id);

-- Il fascicolo deve essere dell'utente stesso: senza questo controllo un id altrui, se indovinato, passerebbe.
create policy "dossier_expected_items_insert_own"
  on public.dossier_expected_items for insert
  with check (
    auth.uid() = owner_id
    and exists (select 1 from public.dossiers d where d.id = dossier_id and d.owner_id = auth.uid())
  );

create policy "dossier_expected_items_update_own"
  on public.dossier_expected_items for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "dossier_expected_items_delete_own"
  on public.dossier_expected_items for delete
  using (auth.uid() = owner_id);

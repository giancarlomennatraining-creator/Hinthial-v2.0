-- La categoria che Hinthia propone per ciascun tipo di documento quando il modello non ne dà una (v.
-- domain/ai/analysis/category-defaults.ts): una tabella predefinita che l'utente può cambiare dalle Impostazioni.
--
-- Una riga è una scelta dell'utente per quel tipo; senza riga vale la corrispondenza predefinita.
-- category_id null = "nessuna categoria": per quel tipo non si propone niente.
--
-- In chiaro come le categorie stesse: dice che le bollette vanno in "Casa", non cosa c'è dentro una bolletta.
-- Additiva: una tabella nuova, nessun dato esistente toccato.

create table public.document_type_categories (
  owner_id uuid not null references auth.users(id) on delete cascade,
  -- L'identificativo del tipo del registro degli schemi ("bolletta", "polizza"...). Nessun elenco chiuso qui: un tipo
  -- nuovo non deve richiedere una migrazione; l'app ignora quelli che non conosce.
  document_type text not null check (char_length(document_type) between 1 and 40),
  -- Se la categoria viene eliminata la scelta cade, e per quel tipo torna la corrispondenza predefinita.
  category_id uuid references public.categories(id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (owner_id, document_type)
);

alter table public.document_type_categories enable row level security;

create policy "document_type_categories_select_own"
  on public.document_type_categories for select
  using (auth.uid() = owner_id);

-- La categoria scelta deve essere dell'utente stesso: senza questo controllo un id altrui, se indovinato, passerebbe.
create policy "document_type_categories_insert_own"
  on public.document_type_categories for insert
  with check (
    auth.uid() = owner_id
    and (
      category_id is null
      or exists (select 1 from public.categories c where c.id = category_id and c.owner_id = auth.uid())
    )
  );

create policy "document_type_categories_update_own"
  on public.document_type_categories for update
  using (auth.uid() = owner_id)
  with check (
    auth.uid() = owner_id
    and (
      category_id is null
      or exists (select 1 from public.categories c where c.id = category_id and c.owner_id = auth.uid())
    )
  );

create policy "document_type_categories_delete_own"
  on public.document_type_categories for delete
  using (auth.uid() = owner_id);

-- Modifica: le categorie diventano una entità pienamente gestibile
-- dall'utente (creazione, modifica, cancellazione), non solo la
-- tassonomia fissa seminata a FASE 4. Le categorie seminate restano
-- semplicemente il punto di partenza --- riga per riga dell'utente,
-- quindi modificarle/eliminarle non tocca nessun altro utente.

create policy "categories_insert_own"
  on public.categories for insert
  to authenticated
  with check (auth.uid() = owner_id);

create policy "categories_update_own"
  on public.categories for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "categories_delete_own"
  on public.categories for delete
  to authenticated
  using (auth.uid() = owner_id);

-- documents.category_id e assets.category_id sono già ON DELETE SET
-- NULL (v. 20260828020000_documents_vault.sql e 20260829000000_assets.sql):
-- eliminare una categoria in uso scollega semplicemente i documenti/asset
-- che la referenziavano, senza eliminarli.

-- FASE 5 --- Metadata e scadenze.
--
-- FASE 4 deliberately left out an UPDATE policy on documents ("there is
-- no edit/rename feature yet"). FASE 5 adds one (editing category,
-- expiry, notes, tags --- never the file content or its name), so the
-- policy needs to exist now. Without it, UPDATE statements are silently
-- accepted by PostgREST but match zero rows under RLS --- no error, no
-- effect, which is exactly the bug this migration fixes.

create policy "documents_update_own"
  on public.documents for update
  to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

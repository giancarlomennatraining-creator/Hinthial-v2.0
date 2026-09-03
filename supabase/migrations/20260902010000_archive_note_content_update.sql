-- FASE 14 --- Archivio: nota testuale.
--
-- Un documento normale non cambia mai il proprio contenuto dopo il
-- caricamento (solo i metadati, v. 20260828040000_documents_update_policy.sql)
-- --- una nota testuale invece si modifica in linea (v.
-- domain/documents/repository.ts, updateTextNoteContent), che sovrascrive
-- lo stesso blob cifrato in Storage con upsert:true. Senza una policy di
-- UPDATE su storage.objects, quell'upsert viene rifiutato dalla RLS
-- ("new row violates row-level security policy") anche se il chiamante
-- è proprio il proprietario del file.

create policy "encrypted_documents_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'encrypted-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'encrypted-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

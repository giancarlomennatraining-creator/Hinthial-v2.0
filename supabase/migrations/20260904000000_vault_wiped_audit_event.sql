-- Modifica: "Cancella tutto" in Impostazioni --- widen audit_events per
-- registrare anche questo evento (v. src/domain/danger-zone), stesso
-- schema già usato per document_created/document_deleted/
-- trusted_contact_added.
alter table public.audit_events drop constraint audit_events_event_type_check;
alter table public.audit_events
  add constraint audit_events_event_type_check
  check (event_type in ('login', 'logout', 'document_created', 'document_deleted', 'trusted_contact_added', 'vault_wiped'));

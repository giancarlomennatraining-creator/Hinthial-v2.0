-- Cronologia per documento --- tre nuovi eventi (modifica, download, lettura
-- del testo sul dispositivo). I metadati degli eventi su un contenuto
-- portano ora anche `documentId` (UUID, identificativo tecnico: mai nome
-- file né contenuto), per poter leggere "cosa è successo a questo
-- documento" dalla sua scheda. Migration additiva: ricrea il vincolo con
-- l'elenco precedente più i nuovi tipi.
alter table public.audit_events drop constraint audit_events_event_type_check;
alter table public.audit_events
  add constraint audit_events_event_type_check
  check (event_type in (
    'login',
    'logout',
    'login_failed',
    'mfa_challenge_failed',
    'mfa_enrolled',
    'mfa_removed',
    'backup_codes_generated',
    'document_created',
    'document_deleted',
    'asset_created',
    'asset_deleted',
    'capsule_created',
    'capsule_deleted',
    'category_created',
    'category_deleted',
    'friend_added',
    'vault_wiped',
    'ai_chat_used',
    'ai_extraction_used',
    'trusted_device_registered',
    'trusted_device_revoked',
    'digital_legacy_reminder_sent',
    'digital_legacy_grace_period_started',
    'digital_legacy_awaiting_guardians',
    'digital_legacy_reset',
    'digital_legacy_guardian_requested',
    'digital_legacy_guardian_responded',
    'digital_legacy_guardians_confirmed',
    'digital_legacy_reset_by_guardian',
    'digital_legacy_formal_verification_started',
    'digital_legacy_final_wait_started',
    'digital_legacy_triggered',
    'friend_request_sent',
    'friend_request_accepted',
    'friend_request_rejected',
    'guardian_role_requested',
    'guardian_role_accepted',
    'guardian_role_rejected',
    'guardian_role_revoked',
    'guardian_role_resigned',
    'proposal_accepted',
    'proposal_rejected',
    'proposal_undone',
    'dossier_created',
    'dossier_deleted',
    'document_trashed',
    'document_restored',
    'document_purged',
    'document_updated',
    'document_downloaded',
    'document_text_read'
  ));

-- Le letture per documento filtrano su metadata->>'documentId'.
create index audit_events_owner_document_idx
  on public.audit_events (owner_id, (metadata->>'documentId'), created_at desc)
  where metadata->>'documentId' is not null;

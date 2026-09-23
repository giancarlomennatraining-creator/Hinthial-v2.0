-- Cestino per i documenti --- v. richiesta utente dopo aver visto la
-- selezione multipla in Archivio: eliminarne più insieme moltiplica il
-- rischio di un errore, quindi l'eliminazione diventa reversibile per
-- un periodo di grazia invece di immediata e definitiva.
--
-- `purge_at` è calcolato e salvato al momento dello spostamento nel
-- cestino (ora + il periodo di conservazione ALLORA in vigore) --- non
-- ricalcolato dinamicamente. Cambiare la preferenza in Impostazioni non
-- deve spostare retroattivamente la scadenza di documenti già nel
-- cestino: un comportamento silenzioso che nessuno si aspetterebbe (v.
-- discussione con l'utente).
alter table public.documents
  add column deleted_at timestamptz,
  add column purge_at timestamptz;

comment on column public.documents.deleted_at is
  'Quando il documento è stato spostato nel cestino --- null se non è nel cestino. Il documento resta cifrato in Storage per tutto il periodo di grazia, non viene toccato finché non scade purge_at.';
comment on column public.documents.purge_at is
  'Quando il documento verrà eliminato per sempre (deleted_at + il periodo di conservazione in vigore al momento dello spostamento nel cestino) --- null se non è nel cestino. Un cron server-side (v. app/api/cron/trash-purge) elimina ogni documento con purge_at nel passato, senza bisogno di decifrare nulla.';

-- Solo i documenti nel cestino contano per la query del cron --- un
-- indice parziale resta piccolo indipendentemente da quanti documenti
-- (la grande maggioranza) non sono mai stati eliminati.
create index documents_purge_at_idx on public.documents (purge_at) where purge_at is not null;

-- Il periodo di conservazione è una scelta chiusa (le sei opzioni del
-- menu in Impostazioni), non un numero libero --- stessa disciplina di
-- digital_legacy_preset, non un range con solo un minimo/massimo.
alter table public.profiles
  add column trash_retention_days integer not null default 15
    check (trash_retention_days in (5, 10, 15, 20, 25, 30));

comment on column public.profiles.trash_retention_days is
  'Per quanti giorni un documento eliminato resta nel Cestino prima di essere rimosso per sempre --- v. TrashRetentionSettings.tsx (Impostazioni > Aspetto).';

-- Nuovi eventi in Attività --- "document_deleted" restava dall'unico
-- percorso di eliminazione precedente (immediato e definitivo); ora che
-- ogni eliminazione passa dal cestino, i tre passi diventano eventi
-- distinti e tracciabili separatamente.
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
    'document_purged'
  ));

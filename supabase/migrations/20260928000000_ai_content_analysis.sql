-- FASE 22 --- Analisi dei contenuti con Claude. Consenso granulare a tre
-- assi: funzione (già esistente: ai_master_enabled/ai_extraction_consent),
-- categoria e singolo contenuto.
--
-- L'asse categoria generalizza l'eccezione speciale ai_health_consent
-- (FASE 22-prep, 2026-09-22): ogni categoria guadagna il proprio consenso
-- invece di un caso a parte solo per Salute --- che diventa semplicemente
-- una riga come le altre, ancora attivabile dall'utente. ai_health_consent
-- non serve più: il consenso per la categoria "Salute" vive ora in
-- categories.ai_extraction_enabled come per qualunque altra categoria.
alter table public.profiles drop column ai_health_consent;

alter table public.categories
  add column ai_extraction_enabled boolean not null default false,
  add column ai_extraction_enabled_until timestamptz null;

comment on column public.categories.ai_extraction_enabled is
  'Consenso permanente a mandare a Claude il testo dei documenti di questa categoria (FASE 22) --- ha effetto solo se profiles.ai_extraction_consent è anche true. Spento di default, come ogni consenso IA in questo progetto.';
comment on column public.categories.ai_extraction_enabled_until is
  'Consenso temporaneo ("per 30 giorni"), indipendente dal permanente --- se nel futuro, abilita la categoria anche con ai_extraction_enabled false. Scelto dal documento al momento di chiedere una lettura, non da questo pannello.';

-- Vince sempre, anche su una categoria abilitata o su un permesso "solo
-- questa volta": un'esclusione esplicita per singolo contenuto non si
-- aggira, altrimenti la funzione stessa non avrebbe senso.
alter table public.documents
  add column ai_extraction_excluded boolean not null default false;

comment on column public.documents.ai_extraction_excluded is
  'Esclusione permanente di questo specifico documento dall''analisi Claude (FASE 22), anche se la sua categoria è abilitata --- vince su qualunque consenso di categoria o scope "once".';

-- Nuovo evento in Attività: l'unica traccia di "cosa è uscito, quando e
-- perché" che la spec richiede --- mai il contenuto o il nome del file,
-- solo la categoria (già in chiaro sul server) e lo scope con cui la
-- chiamata è stata autorizzata (v. metadata jsonb, non un nuovo evento
-- per ogni scope).
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
    'document_purged'
  ));

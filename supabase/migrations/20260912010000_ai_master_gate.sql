-- FASE 11 --- "cancello" generale per l'IA reale, sopra i consensi
-- specifici per singola funzione (oggi solo la Chat, in futuro
-- l'estrazione automatica, i suggerimenti proattivi, ...): deve essere
-- true perché un qualunque consenso specifico abbia effetto. Spegnerlo
-- spegne anche tutti i consensi specifici nella stessa operazione (v.
-- domain/profile/repository.ts, updateAIMasterEnabled) --- riaccenderlo
-- non li riaccende da solo: restano a scelta esplicita, uno per uno.
alter table public.profiles
  add column ai_master_enabled boolean not null default false;

comment on column public.profiles.ai_master_enabled is
  'Cancello generale per l''IA reale (Explicit AI processing) --- deve essere true perché un qualunque consenso specifico (es. ai_chat_consent) abbia effetto. Vedi src/components/ai/AIProcessingConsentProvider.tsx.';

-- Rinominata da ai_processing_consent: era un nome generico finché
-- esisteva un solo uso dell'IA reale (la chat); ora che il cancello
-- sopra fa da generale, questa colonna torna specifica di quella
-- singola funzione, come le sue future sorelle.
alter table public.profiles
  rename column ai_processing_consent to ai_chat_consent;

comment on column public.profiles.ai_chat_consent is
  'Consenso specifico alla Chat reale --- ha effetto solo se ai_master_enabled è true. Vedi AIPanel.tsx.';

-- Nuovo tipo di evento nel registro Attività: traccia ogni volta che una
-- domanda raggiunge davvero Claude (non solo che il consenso lo
-- permette) --- trasparenza verificabile, non solo dichiarata.
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
    'trusted_contact_added',
    'vault_wiped',
    'ai_chat_used'
  ));

-- FASE 11 --- HINTHIAL AI reale, modalità "Explicit AI processing" (v.
-- HINTHIAL_MVP.md sezione 8, "HINTHIAL AI --- vincolo privacy"): l'utente
-- deve autorizzare esplicitamente, dalla UI, l'invio del minimo contesto
-- necessario a un provider esterno (Claude/Anthropic) --- finché non lo
-- fa, l'assistente resta sul solo motore locale (mockAIProvider). Non è
-- un dato sensibile in sé (un booleano), sincronizzato sul server come
-- nav_orientation, non solo su questo dispositivo.
alter table public.profiles
  add column ai_processing_consent boolean not null default false;

comment on column public.profiles.ai_processing_consent is
  'Se true, la pagina AI puo inviare il contesto minimo di una domanda a Claude (Anthropic) per una risposta reale, invece del solo motore locale. Vedi src/components/ai/AIProcessingConsentProvider.tsx.';

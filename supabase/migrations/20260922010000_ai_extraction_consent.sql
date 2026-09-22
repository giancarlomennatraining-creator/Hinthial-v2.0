-- FASE 22 --- consenso preparatorio per l'estrazione avanzata dei
-- contenuti (Claude legge il testo dei documenti, non solo i metadati),
-- la categoria Salute come eccezione a parte dentro quella funzione, la
-- trascrizione audio/video reale (FASE 22b) e gli avvisi proattivi
-- (FASE 24, dipende da ai_extraction_consent). Nessuna di queste
-- funzioni esiste ancora: queste colonne permettono all'utente di
-- impostare già oggi la propria preferenza, che verrà semplicemente
-- rispettata quando la funzione sarà costruita --- v. AIConsentSettings.tsx.
alter table public.profiles
  add column ai_extraction_consent boolean not null default false,
  add column ai_health_consent boolean not null default false,
  add column ai_transcription_consent boolean not null default false,
  add column ai_proactive_alerts_consent boolean not null default false;

comment on column public.profiles.ai_extraction_consent is
  'Consenso specifico all''estrazione avanzata dei contenuti (FASE 22, non ancora costruita) --- ha effetto solo se ai_master_enabled è true. Vale per tutte le categorie tranne Salute (v. ai_health_consent).';

comment on column public.profiles.ai_health_consent is
  'Consenso ulteriore, distinto da ai_extraction_consent, per includere anche la categoria Salute --- ha effetto solo se ai_extraction_consent è true.';

comment on column public.profiles.ai_transcription_consent is
  'Consenso specifico alla trascrizione audio/video reale (FASE 22b, non ancora costruita) --- ha effetto solo se ai_master_enabled è true.';

comment on column public.profiles.ai_proactive_alerts_consent is
  'Consenso specifico agli avvisi proattivi (FASE 24, non ancora costruita) --- ha effetto solo se ai_master_enabled E ai_extraction_consent sono entrambi true: non esiste una terza via per generare un avviso senza aver prima letto i contenuti.';

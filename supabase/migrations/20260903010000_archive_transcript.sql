-- Modifica: trascrizione (facoltativa) per i contenuti audio/video
-- dell'archivio --- v. src/domain/transcription per il motore (oggi
-- solo un segnaposto in attesa di un vero motore locale, FASE 11):
-- l'utente la scrive a mano nel frattempo. Cifrata col Master Key come
-- note/tag, mai un dato in chiaro sul server.
alter table public.documents
  add column encrypted_transcript text;

comment on column public.documents.encrypted_transcript is
  'Trascrizione (facoltativa) di un contenuto audio/video, cifrata col Master Key come le note. Null se non impostata o non applicabile.';

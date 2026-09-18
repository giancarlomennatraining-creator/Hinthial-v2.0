-- FASE 17 (1/N) --- testo ricavato automaticamente dal contenuto di un
-- elemento d'Archivio (per ora: PDF), estratto SUL DISPOSITIVO prima
-- della cifratura (v. src/domain/extraction) e cifrato col Master Key
-- come note/tag/trascrizione: il server continua a non vedere nulla.
--
-- Colonna distinta da `encrypted_transcript` di proposito: quella è
-- scritta a mano dall'utente per audio/video ed è un suo contenuto,
-- questa è derivata dal file e si può rigenerare in qualunque momento
-- ri-estraendola. Tenerle insieme significherebbe che un'estrazione
-- automatica può sovrascrivere ciò che l'utente ha scritto.
alter table public.documents
  add column encrypted_extracted_text text;

comment on column public.documents.encrypted_extracted_text is
  'Testo ricavato automaticamente dal contenuto (PDF e, in futuro, OCR/trascrizione), cifrato col Master Key. Derivato e rigenerabile --- diverso da encrypted_transcript, scritto a mano dall''utente. Null se non applicabile o non ancora estratto.';

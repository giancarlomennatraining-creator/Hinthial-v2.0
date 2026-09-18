-- FASE 17b --- quando l'estrazione del testo è stata tentata su questo
-- contenuto (v. domain/extraction). Serve a distinguere tre situazioni
-- che finora erano indistinguibili, perché in tutte e tre
-- `encrypted_extracted_text` risulta vuoto:
--
--   1. mai tentata      -> extracted_at null   (caricato prima della FASE 17)
--   2. tentata, testo    -> extracted_at valorizzato + testo presente
--   3. tentata, nulla    -> extracted_at valorizzato + testo assente
--                           (es. un PDF fatto di sole scansioni)
--
-- Senza questa distinzione il recupero dei documenti già in archivio non
-- saprebbe quali ha già guardato, e riproverebbe ogni volta su quelli
-- che non hanno testo da dare.
--
-- Solo una data, mai il contenuto: il server continua a non vedere nulla
-- di leggibile.
alter table public.documents
  add column extracted_at timestamptz;

comment on column public.documents.extracted_at is
  'Quando è stata tentata l''estrazione del testo (v. domain/extraction). Null = mai tentata, es. caricato prima della FASE 17. Valorizzato con encrypted_extracted_text vuoto = tentata senza risultato (tipicamente una scansione, in attesa dell''OCR).';

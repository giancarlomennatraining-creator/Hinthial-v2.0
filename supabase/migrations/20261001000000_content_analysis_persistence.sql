-- Content Intelligence, PR3 (passo A): ciò che Hinthia ricava da un documento
-- non vive più solo nella pagina aperta. Solo colonne nuove e nullable ---
-- additivo: un client che le ignora continua a funzionare come prima.
--
-- encrypted_content_analysis è l'unico blocco col contenuto (tipo
-- riconosciuto, risultati per blocco con citazione e provenienza, sintesi,
-- impronta di idempotenza, versioni della pipeline), cifrato con la Master
-- Key come encrypted_structured_fields: il server non lo legge mai.
--
-- analysis_status è in chiaro di proposito ed è volutamente grossolano: dice
-- solo a che punto è la lettura, mai che cosa dice il documento.
alter table public.documents
  add column encrypted_content_analysis text null,
  add column analysis_status text null,
  add column analysis_updated_at timestamptz null;

alter table public.documents
  add constraint documents_analysis_status_check
  check (analysis_status is null or analysis_status in ('pending', 'completed', 'partial', 'failed'));

comment on column public.documents.encrypted_content_analysis is
  'Risultato cifrato dell''ultima lettura di Hinthia: tipo, blocchi validati con citazione e provenienza, sintesi, impronta HMAC (mai in chiaro), versioni. Sostituito a ogni lettura, azzerato se il testo del documento cambia.';
comment on column public.documents.analysis_status is
  'Stato grossolano della lettura, senza alcuna informazione sul contenuto: pending, completed, partial o failed. null = mai letto da Hinthia.';
comment on column public.documents.analysis_updated_at is
  'Ultimo salvataggio di encrypted_content_analysis --- null se il documento non è mai stato letto da Hinthia.';

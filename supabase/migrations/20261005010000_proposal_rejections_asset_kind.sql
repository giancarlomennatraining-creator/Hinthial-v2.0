-- Hinthial propone di collegare un documento al suo bene quando ha la stessa
-- targa o lo stesso numero di polizza di un documento già collegato. Rifiutare
-- la proposta registra, come per le altre, un rifiuto cifrato: serve che
-- 'asset' sia un tipo ammesso. Additiva: allarga il vincolo, non tocca i dati.
alter table public.proposal_rejections drop constraint proposal_rejections_kind_check;
alter table public.proposal_rejections
  add constraint proposal_rejections_kind_check
  check (kind in ('expiry', 'category', 'issuer', 'field', 'event', 'asset'));

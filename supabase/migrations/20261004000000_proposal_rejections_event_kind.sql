-- Gli eventi con data letti da Hinthia (rinnovi, pagamenti, visite) si
-- propongono come scadenze da aggiungere in Scadenze. Rifiutarne uno
-- registra, come per le altre proposte, un rifiuto cifrato: serve che
-- 'event' sia un tipo ammesso. Additiva: allarga il vincolo, non tocca i dati.
alter table public.proposal_rejections drop constraint proposal_rejections_kind_check;
alter table public.proposal_rejections
  add constraint proposal_rejections_kind_check
  check (kind in ('expiry', 'category', 'issuer', 'field', 'event'));

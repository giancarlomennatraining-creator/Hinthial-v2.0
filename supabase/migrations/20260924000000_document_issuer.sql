-- FASE 18/19 --- l'emittente diventa un campo vero (prima solo mostrato,
-- v. CHANGELOG.md): cifrato come le note, non un id/una data come
-- scadenza/categoria, perché è testo libero letto da un documento.
alter table documents
  add column encrypted_issuer text null;

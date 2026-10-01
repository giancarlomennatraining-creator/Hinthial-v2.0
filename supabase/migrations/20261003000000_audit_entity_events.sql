-- Registro eventi riprogettato: ogni evento su un item (contenuto, bene, amico,
-- capsula, fascicolo, categoria) è agganciato all'item con due colonne vere
-- (`entity_type`, `entity_id`) invece del `documentId` dentro i metadati JSON.
-- Gli eventi "di sistema" (accessi, sicurezza, dispositivi, eredità digitale)
-- restano senza riferimento a un item e si vedono in Impostazioni > Attività.
--
-- Si riparte da zero: i vecchi eventi vengono cancellati (scelta esplicita
-- dell'utente --- includono anche accessi e sicurezza registrati finora). La
-- tabella è append-only per l'app (nessuna policy di delete): la pulizia
-- passa da qui, da migrazione.
--
-- `encrypted_label`: titolo dell'item cifrato con la master key, scritto solo
-- negli eventi di eliminazione per sempre, per riconoscere l'item dopo che la
-- sua scheda non esiste più. Mai in chiaro, leggibile solo a vault sbloccato.
--
-- Il vincolo sui tipi di evento viene tolto: i tipi sono validati nel codice
-- (AuditEventType), così un nuovo evento non richiede più una migrazione e un
-- inserimento rifiutato non fallisce più in silenzio per un vincolo non aggiornato.

delete from public.audit_events;

alter table public.audit_events drop constraint if exists audit_events_event_type_check;

drop index if exists public.audit_events_owner_document_idx;

alter table public.audit_events
  add column entity_type text,
  add column entity_id uuid,
  add column encrypted_label text;

alter table public.audit_events
  add constraint audit_events_entity_type_check
  check (entity_type in ('document', 'asset', 'friend', 'capsule', 'dossier', 'category')),
  add constraint audit_events_entity_pair_check
  check ((entity_type is null) = (entity_id is null));

comment on column public.audit_events.entity_type is
  'Tipo di item a cui l''evento è agganciato; null per gli eventi di sistema.';
comment on column public.audit_events.entity_id is
  'Id tecnico (UUID) dell''item; mai nome o contenuto. Nessuna foreign key: gli eventi sopravvivono all''item eliminato.';
comment on column public.audit_events.encrypted_label is
  'Titolo cifrato (master key) dell''item, solo negli eventi di eliminazione per sempre.';

-- Cronologia di un item, impaginata per (created_at, id).
create index audit_events_entity_idx
  on public.audit_events (owner_id, entity_type, entity_id, created_at desc, id desc)
  where entity_id is not null;

-- Elenco degli eventi di sistema, impaginato per (created_at, id).
create index audit_events_owner_created_id_idx
  on public.audit_events (owner_id, created_at desc, id desc);

-- FASE 20c --- un documento può stare in più di un fascicolo insieme.
--
-- Nato da un caso reale: un codice fiscale o un documento d'identità è
-- "a corredo" di più vicende insieme (un problema di salute E l'acquisto
-- di una casa), non di una sola. Prima, `documents.dossier_id` era una
-- relazione singola (molti documenti -> un fascicolo, come category_id
-- e related_asset_id): qui diventa una tabella ponte, molti-a-molti.
--
-- owner_id duplicato qui apposta, non un join su documents/dossiers per
-- le regole di accesso --- stesso schema già in uso per
-- capsule_share_keys (v. quella migrazione): più semplice e più veloce.

create table public.document_dossiers (
  document_id uuid not null references public.documents(id) on delete cascade,
  dossier_id uuid not null references public.dossiers(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (document_id, dossier_id)
);

comment on table public.document_dossiers is
  'Collegamento molti-a-molti documento<->fascicolo (v. HINTHIAL_MVP.md FASE 20b/20c). Sostituisce documents.dossier_id --- un documento può stare in più fascicoli insieme.';

create index document_dossiers_dossier_id_idx on public.document_dossiers (dossier_id);
create index document_dossiers_document_id_idx on public.document_dossiers (document_id);

alter table public.document_dossiers enable row level security;

create policy "document_dossiers_select_own"
  on public.document_dossiers for select
  using (auth.uid() = owner_id);

create policy "document_dossiers_insert_own"
  on public.document_dossiers for insert
  with check (auth.uid() = owner_id);

create policy "document_dossiers_delete_own"
  on public.document_dossiers for delete
  using (auth.uid() = owner_id);

-- Nessuna policy di update: l'insieme dei fascicoli di un documento si
-- sostituisce cancellando e reinserendo (v. domain/dossiers/repository.ts,
-- replaceDocumentDossierLinks), non modificando una riga esistente.

-- ---------------------------------------------------------------------
-- Migrazione dei dati esistenti: ogni dossier_id già assegnato diventa
-- la prima riga della nuova tabella, poi la vecchia colonna se ne va.
-- ---------------------------------------------------------------------

insert into public.document_dossiers (document_id, dossier_id, owner_id)
select d.id, d.dossier_id, d.owner_id
from public.documents d
where d.dossier_id is not null;

drop index if exists public.documents_dossier_id_idx;
alter table public.documents drop column dossier_id;

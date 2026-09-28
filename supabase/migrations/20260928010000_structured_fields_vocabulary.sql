-- Campi eterogenei per documento: un contenitore chiave-valore aperto
-- (numero di polizza, targa, data di nascita, ...) invece di continuare
-- ad aggiungere colonne fisse per ogni nuovo tipo di fatto che un
-- documento può contenere. Scadenza/categoria/emittente non si toccano
-- --- restano le colonne dedicate di sempre; questo è additivo, solo per
-- i campi nuovi.
--
-- Il vocabolario governa la SCRITTURA, non il ragionamento: Claude può
-- sempre proporre un campo nuovo, ma la prima volta che l'utente accetta
-- quella chiave viene registrata qui, così i documenti successivi dello
-- stesso tipo useranno lo stesso nome invece di uno leggermente diverso
-- ogni volta. Plaintext come categories.name: un nome di campo ("numero
-- polizza") è un'etichetta generica, non un contenuto personale.
create table public.structured_field_vocabulary (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  field_key text not null,
  label text not null,
  created_at timestamptz not null default now(),
  unique (owner_id, field_key)
);

comment on table public.structured_field_vocabulary is
  'Vocabolario personale dei campi non standard riconosciuti su un documento --- cresce quando l''utente accetta per la prima volta una chiave nuova proposta da Claude.';

alter table public.structured_field_vocabulary enable row level security;

create policy "structured_field_vocabulary_select_own"
  on public.structured_field_vocabulary for select
  to authenticated
  using (auth.uid() = owner_id);

create policy "structured_field_vocabulary_insert_own"
  on public.structured_field_vocabulary for insert
  to authenticated
  with check (auth.uid() = owner_id);

-- I valori dei campi vivono in un unico blob cifrato per documento,
-- come encrypted_tags (un oggetto invece di un array). La sintesi di
-- Claude segue lo stesso schema di encrypted_extracted_text/extracted_at
-- (FASE 17): un solo valore, sostituito --- mai accumulato --- a ogni
-- lettura riuscita, perché non è una proposta da accettare, solo una
-- lettura d'insieme informativa.
alter table public.documents
  add column encrypted_structured_fields text null,
  add column encrypted_ai_synthesis text null,
  add column ai_synthesis_generated_at timestamptz null;

comment on column public.documents.encrypted_structured_fields is
  'Oggetto {chiave: valore} cifrato con la Master Key, come encrypted_tags ma un oggetto invece di un array --- i campi non coperti da categoria/scadenza/emittente (v. structured_field_vocabulary per i nomi noti).';
comment on column public.documents.encrypted_ai_synthesis is
  'Sintesi/descrizione/analisi in prosa dell''ultima lettura Claude riuscita --- cifrata, sostituita a ogni rilettura, mai una proposta.';
comment on column public.documents.ai_synthesis_generated_at is
  'Quando è stata generata encrypted_ai_synthesis --- null se il documento non è mai stato letto da Claude.';

-- proposal_rejections.kind non era mai stato allargato a 'issuer' (FASE
-- 18/24): rifiutare una proposta di emittente falliva silenziosamente
-- contro questo vincolo --- corretto qui insieme all'aggiunta di
-- 'field'. field_key è null per i tre kind esistenti, impostato solo
-- per 'field': senza, il rifiuto di un valore su una chiave
-- collisionerebbe con lo stesso valore su una chiave diversa.
alter table public.proposal_rejections
  add column field_key text null;

alter table public.proposal_rejections drop constraint proposal_rejections_kind_check;
alter table public.proposal_rejections
  add constraint proposal_rejections_kind_check
  check (kind in ('expiry', 'category', 'issuer', 'field'));

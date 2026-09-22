-- Scheda d'emergenza --- pochi campi scritti una volta (gruppo
-- sanguigno, allergie, condizioni rilevanti, farmaci abituali, medico
-- di riferimento, contatti di emergenza), pensati per essere stampati
-- in formato tessera e portati nel portafoglio, non per lo schermo.
--
-- Una riga per account (owner_id è la chiave primaria, non un id a
-- sé): non c'è mai più di una scheda d'emergenza. Tutto cifrato come
-- ogni altro contenuto testuale dell'utente --- sono dati sanitari,
-- la stessa architettura zero-knowledge di un documento o di una nota
-- si applica qui a maggior ragione, anche se lo scopo finale della
-- scheda è che l'utente stesso la mostri in chiaro stampandola.
--
-- encrypted_contacts è un array JSON cifrato in blocco ({name,
-- relation, phone}[]) --- stesso schema di documents.encrypted_tags:
-- pochi elementi, nessun bisogno di interrogarli separatamente lato
-- server.

create table public.emergency_cards (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  encrypted_blood_type text,
  encrypted_allergies text,
  encrypted_conditions text,
  encrypted_medications text,
  encrypted_doctor_name text,
  encrypted_doctor_phone text,
  encrypted_contacts text,
  updated_at timestamptz not null default now()
);

comment on table public.emergency_cards is
  'Scheda d''emergenza stampabile --- una riga per account, tutta cifrata. v. domain/emergency-card.';

alter table public.emergency_cards enable row level security;

create policy "emergency_cards_select_own"
  on public.emergency_cards for select
  using (auth.uid() = owner_id);

create policy "emergency_cards_insert_own"
  on public.emergency_cards for insert
  with check (auth.uid() = owner_id);

create policy "emergency_cards_update_own"
  on public.emergency_cards for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "emergency_cards_delete_own"
  on public.emergency_cards for delete
  using (auth.uid() = owner_id);

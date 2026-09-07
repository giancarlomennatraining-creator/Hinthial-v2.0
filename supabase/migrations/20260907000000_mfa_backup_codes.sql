-- Modifica: codici di backup monouso per l'autenticazione a due fattori
-- --- coprono lo scenario in cui si perde l'accesso a tutti i fattori
-- registrati (TOTP/passkey). Supabase non li gestisce nativamente: qui
-- si salva solo l'hash SHA-256 del codice (Web Crypto API, nessuna
-- crypto custom, v. domain/mfa/backup-codes.ts) --- il codice in
-- chiaro esiste solo un istante, mostrato una volta sola all'utente e
-- mai persistito. Un codice usato viene cancellato subito (monouso):
-- nessuna colonna "used_at", una riga esistente è per definizione
-- ancora valida.
create table public.mfa_backup_codes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,
  created_at timestamptz not null default now()
);

create index mfa_backup_codes_owner_id_idx on public.mfa_backup_codes(owner_id);

alter table public.mfa_backup_codes enable row level security;

create policy "mfa_backup_codes_select_own"
  on public.mfa_backup_codes for select
  to authenticated
  using (auth.uid() = owner_id);

create policy "mfa_backup_codes_insert_own"
  on public.mfa_backup_codes for insert
  to authenticated
  with check (auth.uid() = owner_id);

create policy "mfa_backup_codes_delete_own"
  on public.mfa_backup_codes for delete
  to authenticated
  using (auth.uid() = owner_id);

-- Nessuna policy di update: un codice non si modifica, si genera o si cancella.

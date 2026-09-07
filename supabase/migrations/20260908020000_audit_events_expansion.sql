-- Modifica: registro Attività più ricco (Impostazioni > Attività) ---
-- tentativi falliti di login/MFA, attivazione/rimozione dell'MFA e dei
-- codici di backup, distinzione del metodo di login, IP/dispositivo di
-- ogni login, e creazione/eliminazione di asset/capsule/categorie.

alter table public.audit_events add column metadata jsonb;

comment on column public.audit_events.metadata is
  'Dettagli tecnici facoltativi per evento (es. method/ip/user_agent per i login, reason per i tentativi falliti) --- mai contenuti, nomi file/contatto o altro dato del vault: solo metadati tecnici, in chiaro come il resto della riga.';

alter table public.audit_events drop constraint audit_events_event_type_check;
alter table public.audit_events
  add constraint audit_events_event_type_check
  check (event_type in (
    'login',
    'logout',
    'login_failed',
    'mfa_challenge_failed',
    'mfa_enrolled',
    'mfa_removed',
    'backup_codes_generated',
    'document_created',
    'document_deleted',
    'asset_created',
    'asset_deleted',
    'capsule_created',
    'capsule_deleted',
    'category_created',
    'category_deleted',
    'trusted_contact_added',
    'vault_wiped'
  ));

-- ---------------------------------------------------------------------
-- log_failed_login_attempt: registra un tentativo di login fallito
-- ---------------------------------------------------------------------
-- Un login con password errata non ha ancora una sessione autenticata:
-- auth.uid() è null, quindi l'insert diretto in audit_events (che
-- richiede auth.uid() = owner_id) non è possibile per chi chiama. Questa
-- funzione, SECURITY DEFINER, aggira le RLS solo per questo scopo
-- puntuale --- e non rivela mai al chiamante se l'email corrisponde a un
-- account esistente (nessun errore/valore diverso nei due casi),
-- altrimenti diventerebbe un modo per enumerare gli account registrati.
create or replace function public.log_failed_login_attempt(target_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
begin
  select id into target_id from auth.users where email = target_email;
  if target_id is not null then
    insert into public.audit_events (owner_id, event_type, metadata)
    values (target_id, 'login_failed', jsonb_build_object('method', 'password'));
  end if;
end;
$$;

revoke all on function public.log_failed_login_attempt(text) from public;
grant execute on function public.log_failed_login_attempt(text) to anon, authenticated;

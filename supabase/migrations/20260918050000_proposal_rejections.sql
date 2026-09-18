-- FASE 19 --- il meccanismo delle proposte.
--
-- Questa tabella è la "memoria dei rifiuti": ciò che l'utente ha
-- scartato non gli viene riproposto. Senza, una proposta rifiutata
-- ricomparirebbe a ogni apertura della scheda, e un assistente che
-- ripete la stessa domanda dopo che gli hai già detto di no smette di
-- essere un assistente.
--
-- Si registrano **solo i rifiuti**. Un'accettazione non ha bisogno di
-- memoria: il valore finisce nel documento (`expires_at`,
-- `category_id`), e ciò che è già impostato non viene più proposto. Se
-- l'utente più tardi svuota quel campo a mano, la proposta torna --- ed è
-- il comportamento giusto, perché il documento è tornato incompleto.
--
-- Il valore rifiutato è **cifrato con la Master Key**, come ogni altro
-- contenuto. Non è pignoleria: una scadenza accettata finisce comunque
-- in chiaro in `documents.expires_at`, ma una scadenza RIFIUTATA non
-- esisterebbe da nessuna parte sul server, e salvarla in chiaro
-- introdurrebbe un dato che senza questa tabella non ci sarebbe. Il
-- confronto tra una proposta nuova e i rifiuti passati avviene sul
-- client, dopo la decifratura --- l'unico posto dove può avvenire.

create table public.proposal_rejections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  -- Il tipo di campo proposto. In chiaro: dice che genere di proposta è
  -- stata rifiutata, mai quale valore --- lo stesso livello di dettaglio
  -- che il server ha già su `documents`.
  kind text not null check (kind in ('expiry', 'category')),
  encrypted_value text not null,
  decided_at timestamptz not null default now()
);

-- Le proposte si calcolano per un documento alla volta, aprendo la sua
-- scheda: è quello l'accesso da rendere veloce.
create index proposal_rejections_document_idx
  on public.proposal_rejections (document_id);

alter table public.proposal_rejections enable row level security;

create policy "proposal_rejections_select_own"
  on public.proposal_rejections for select
  using (auth.uid() = owner_id);

create policy "proposal_rejections_insert_own"
  on public.proposal_rejections for insert
  with check (auth.uid() = owner_id);

-- Nessuna policy di update: un rifiuto non si modifica. Si annulla
-- (delete, per il tasto "Annulla") oppure resta com'è.
create policy "proposal_rejections_delete_own"
  on public.proposal_rejections for delete
  using (auth.uid() = owner_id);

-- ---------------------------------------------------------------------
-- audit_events: due tipi nuovi, perché ogni scrittura automatica deve
-- lasciare traccia in Attività --- è metà del motivo per cui la FASE 19
-- esiste.
-- ---------------------------------------------------------------------

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
    'friend_added',
    'vault_wiped',
    'ai_chat_used',
    'trusted_device_registered',
    'trusted_device_revoked',
    'digital_legacy_reminder_sent',
    'digital_legacy_grace_period_started',
    'digital_legacy_awaiting_guardians',
    'digital_legacy_reset',
    'digital_legacy_guardian_requested',
    'digital_legacy_guardian_responded',
    'digital_legacy_guardians_confirmed',
    'digital_legacy_reset_by_guardian',
    'digital_legacy_formal_verification_started',
    'digital_legacy_final_wait_started',
    'digital_legacy_triggered',
    'friend_request_sent',
    'friend_request_accepted',
    'friend_request_rejected',
    'guardian_role_requested',
    'guardian_role_accepted',
    'guardian_role_rejected',
    'guardian_role_revoked',
    'guardian_role_resigned',
    'proposal_accepted',
    'proposal_rejected',
    'proposal_undone'
  ));

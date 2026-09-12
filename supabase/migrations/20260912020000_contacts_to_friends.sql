-- Modifica: "Contatti fiduciari" diventa "Amici" nell'interfaccia e
-- negli url (v. CHANGELOG.md) --- il flag interno "amico" (Dead Man's
-- Switch semplificato per le capsule, v. migrazione 20260905000000)
-- diventa a sua volta "guardiano", per non sovrapporsi al nuovo nome
-- della sezione intera. Rinominati qui tabella, colonna, indice,
-- trigger, policy e vincolo di chiave esterna, oltre al tipo di evento
-- nel registro Attività --- nessun dato reale da migrare (progetto in
-- sviluppo, v. README).

alter table public.trusted_contacts rename to friends;
alter table public.friends rename column is_friend to is_guardian;

alter index trusted_contacts_owner_id_created_at_idx rename to friends_owner_id_created_at_idx;
alter table public.friends rename constraint trusted_contacts_owner_id_fkey to friends_owner_id_fkey;
alter trigger trusted_contacts_set_updated_at on public.friends rename to friends_set_updated_at;

alter policy "trusted_contacts_select_own" on public.friends rename to "friends_select_own";
alter policy "trusted_contacts_insert_own" on public.friends rename to "friends_insert_own";
alter policy "trusted_contacts_update_own" on public.friends rename to "friends_update_own";
alter policy "trusted_contacts_delete_own" on public.friends rename to "friends_delete_own";

comment on table public.friends is
  'Friend (ex TrustedContact) per HINTHIAL_MVP.md sezione 5 (FASE 7). Nessuno sblocco automatico dei dati in questa fase --- solo struttura dati + gestione dello stato.';
comment on column public.friends.is_guardian is
  'Amico che riceve un avviso informale in caso di inattività prolungata del proprietario (ex "amico"/is_friend) --- solo un flag, nessuna azione richiesta da parte sua.';

-- audit_events: trusted_contact_added -> friend_added. Il vincolo va
-- allentato PRIMA di riscrivere le righe già registrate durante lo
-- sviluppo (mai dati reali --- v. README): l'update sotto userebbe
-- comunque il valore nuovo, non ancora ammesso dal vincolo vecchio.
alter table public.audit_events drop constraint audit_events_event_type_check;

update public.audit_events set event_type = 'friend_added' where event_type = 'trusted_contact_added';
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
    'ai_chat_used'
  ));

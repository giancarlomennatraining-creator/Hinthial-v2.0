-- Il popup in Dashboard che avvisa il destinatario di una capsula
-- appena condivisa con lui (v. richiesta utente) deve poter sparire
-- "per sempre" una volta chiuso --- senza un modo di ricordarlo lato
-- server, ricomparirebbe a ogni visita.
alter table public.capsule_shares add column dismissed_at timestamptz;

comment on column public.capsule_shares.dismissed_at is
  'Quando il destinatario ha chiuso il popup di notifica in Dashboard --- null finché non lo fa. Non ha alcun ruolo di sicurezza (non condiziona status/apertura della capsula), solo l''interfaccia.';

-- Il destinatario può segnare come vista la propria riga --- mai
-- riassegnarla a un altro destinatario o cambiarne altro (v.
-- domain/capsules/repository.ts, dismissCapsuleShareNotification: manda
-- sempre e solo { dismissed_at }).
create policy "capsule_shares_update_recipient"
  on public.capsule_shares for update
  to authenticated
  using (auth.uid() = recipient_user_id)
  with check (auth.uid() = recipient_user_id);

-- Elimina il concetto di "In attesa" per gli amici (v. richiesta utente)
-- --- non bloccava nulla di voluto: l'unico effetto reale era nascondere
-- l'amico dal selettore dei destinatari delle capsule
-- (CreateCapsuleForm/EditCapsuleForm, che filtrano status === "active")
-- finché non lo si segnava a mano come "attivo", un effetto collaterale
-- confuso, non lo scopo dello stato. Chi era "pending" diventa "active"
-- --- comportamento più utile, non più permissivo di quello che capitava
-- comunque un click dopo ("Segna come attivo", ora rimosso dall'interfaccia).

update friends set status = 'active' where status = 'pending';

alter table friends drop constraint trusted_contacts_status_check;
alter table friends add constraint friends_status_check check (status in ('active', 'revoked'));
alter table friends alter column status set default 'active';

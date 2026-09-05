-- Dead Man's Switch per le capsule (versione semplificata, HINTHIAL_MVP.md
-- FASE 12/13 --- solo la parte che riguarda le capsule, non ancora il
-- meccanismo più ampio a livello di intero account, che resta da
-- affrontare in seguito).
--
-- open_at diventa una colonna in chiaro (prima viveva solo dentro
-- encrypted_payload): è l'unica eccezione consapevole al "tutto cifrato"
-- in questa tabella --- espone solo una data, mai contenuto/titolo/
-- destinatari. Serve perché il server deve poter sapere *quando* una
-- capsula è pronta per essere aperta e avvisare il destinatario, senza
-- dover decifrare nulla (cosa che comunque non può fare: non ha mai la
-- Master Key). Nullable a livello DB per le capsule già esistenti (create
-- prima di questa migrazione, la cui data vive solo nel payload cifrato)
-- --- l'app la richiede obbligatoriamente per ogni nuova capsula o
-- modifica, e ripristina da sola il valore in chiaro leggendo il payload
-- cifrato la prima volta che il proprietario le rivede (v.
-- domain/capsules/repository.ts, listCapsules).
alter table public.capsules add column open_at date;

comment on column public.capsules.open_at is
  'Data di apertura, in chiaro (unica eccezione in questa tabella) --- necessaria al server per sapere quando avvisare il destinatario, senza decifrare nulla.';

-- "Amico": un contatto fiduciario che, nella versione semplificata del
-- Dead Man's Switch, riceve solo un avviso informale quando il
-- proprietario risulta inattivo da tempo --- nessuna conferma richiesta
-- da parte sua, nessun ruolo di verifica formale (a differenza di quanto
-- discusso inizialmente). Come "status", per ora solo un flag registrato:
-- nessuno sblocco automatico di dati avviene qui.
alter table public.trusted_contacts add column is_friend boolean not null default false;

comment on column public.trusted_contacts.is_friend is
  'Contatto che riceve un avviso informale in caso di inattività prolungata del proprietario --- solo un flag, nessuna azione richiesta da parte sua.';

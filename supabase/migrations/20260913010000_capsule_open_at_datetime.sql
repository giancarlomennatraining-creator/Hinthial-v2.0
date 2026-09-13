-- Modifica: la data di apertura di una capsula diventa data E ora,
-- non più solo il giorno --- v. src/components/capsules/CapsuleOpenAtField.tsx
-- (ora un <input type="datetime-local">, non più type="date") e
-- CapsuleInput/CapsuleEditInput.openAt (già un ISO datetime completo,
-- non "YYYY-MM-DD"). `date` diventa `timestamptz`, coerente con come
-- reminders.due_at gestisce già un momento preciso nel tempo, non solo
-- un giorno di calendario. Nessun dato reale da migrare (progetto in
-- sviluppo, v. README) --- le poche righe di test esistenti restano
-- valide: un valore "YYYY-MM-DD" resta comunque interpretabile come
-- mezzanotte UTC di quel giorno.

alter table public.capsules
  alter column open_at type timestamptz using open_at::timestamptz;

comment on column public.capsules.open_at is
  'Data E ORA in cui la capsula è pensata per essere aperta, in chiaro apposta --- v. migrazione 20260905000000 e CapsuleListItem.openAt. Diventata timestamptz (prima solo date) per includere l''orario, non solo il giorno.';

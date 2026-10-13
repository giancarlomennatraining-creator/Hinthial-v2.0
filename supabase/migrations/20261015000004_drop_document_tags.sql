-- I tag non esistono più: i documenti si classificano solo per categoria. Applicare DOPO aver aggiornato il codice,
-- che non legge più la colonna (con il codice vecchio il caricamento dei documenti si romperebbe).
alter table public.documents drop column if exists encrypted_tags;

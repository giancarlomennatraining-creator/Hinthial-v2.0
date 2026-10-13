-- Via le funzioni congelate: la trascrizione scritta a mano (documents.encrypted_transcript) e i consensi per due
-- funzioni che non sono mai esistite (trascrizione audio/video, avvisi proattivi). Il consenso all'estrazione avanzata
-- resta: è quello che autorizza Hinthia a leggere i documenti. Applicare DOPO aver aggiornato il codice (le vecchie
-- query leggono encrypted_transcript). Irreversibile: le trascrizioni già scritte vanno perse.
alter table public.documents drop column if exists encrypted_transcript;
alter table public.profiles drop column if exists ai_transcription_consent;
alter table public.profiles drop column if exists ai_proactive_alerts_consent;

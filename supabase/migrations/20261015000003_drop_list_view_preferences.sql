-- Ogni sezione ha un solo modo di mostrarsi (l'elenco): la scelta elenco/tabella e le viste alternative dell'Archivio non ci sono più.
alter table public.profiles drop column if exists list_view_preferences;

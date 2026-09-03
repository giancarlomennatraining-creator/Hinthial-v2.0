-- Modifica: modalità di visualizzazione (elenco / tabella impaginata) per
-- ogni sezione con liste (Archivio, Scadenze, Asset, Contatti fiduciari,
-- Capsule, Cronologia) --- gestita da Impostazioni > Aspetto, e
-- sincronizzata su tutti i dispositivi dell'utente (esplicitamente
-- richiesto diverso dal tema chiaro/scuro, che resta solo locale). Non è
-- un dato sensibile (nessun contenuto del vault, solo una preferenza
-- d'aspetto), quindi vive in chiaro come le altre colonne di profiles.
alter table public.profiles
  add column list_view_preferences jsonb not null default '{}'::jsonb;

comment on column public.profiles.list_view_preferences is
  'Preferenza di visualizzazione (elenco/tabella) per sezione, es. {"archive":"table"}. Chiavi assenti = elenco (default). Vedi src/lib/list-view.ts.';

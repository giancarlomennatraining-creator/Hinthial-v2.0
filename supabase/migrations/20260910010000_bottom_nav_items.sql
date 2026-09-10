-- Modifica: quali voci della navigazione principale appaiono nella barra
-- fissa in basso su smartphone (v. src/lib/bottom-nav.ts) --- le altre
-- restano comunque raggiungibili dal menu con le 3 lineette. Gestita da
-- Impostazioni > Aspetto, sincronizzata su tutti i dispositivi
-- dell'utente, stesso meccanismo di list_view_preferences (jsonb, non un
-- valore fisso come nav_orientation: qui è un elenco di href).
alter table public.profiles
  add column bottom_nav_items jsonb not null default '["/dashboard", "/archive", "/reminders", "/capsules"]'::jsonb;

comment on column public.profiles.bottom_nav_items is
  'Elenco (jsonb) degli href di NAV_ITEMS mostrati nella barra fissa in basso su smartphone. Vedi src/lib/bottom-nav.ts.';

-- Modifica: disposizione del menu di navigazione principale --- verticale
-- (barra laterale a sinistra o a destra) oppure orizzontale (barra in
-- alto). Gestita da Impostazioni > Aspetto, sincronizzata su tutti i
-- dispositivi dell'utente --- stesso meccanismo della visualizzazione
-- delle liste (v. list_view_preferences). Non è un dato sensibile,
-- vive in chiaro come le altre colonne di profiles.
alter table public.profiles
  add column nav_orientation text not null default 'sidebar-left'
    check (nav_orientation in ('sidebar-left', 'sidebar-right', 'topbar'));

comment on column public.profiles.nav_orientation is
  'Disposizione del menu di navigazione: sidebar-left (default), sidebar-right, o topbar. Vedi src/lib/nav-orientation.ts.';

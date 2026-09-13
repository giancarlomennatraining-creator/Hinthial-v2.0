alter table public.profiles
  add column main_nav_items jsonb;

comment on column public.profiles.main_nav_items is 'Quali voci della barra di navigazione generale (sidebar/barra orizzontale) mostrare, e in che ordine --- array jsonb di href, in chiaro come bottom_nav_items/nav_orientation. Null = mai personalizzata, l''interfaccia mostra tutte le voci nell''ordine di default (v. lib/main-nav.ts, parseMainNavItems).';

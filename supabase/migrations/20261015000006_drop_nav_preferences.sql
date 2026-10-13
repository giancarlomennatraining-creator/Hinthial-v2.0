-- La navigazione è la stessa per tutti: via la disposizione del menu, le voci del menu e la barra in basso.
alter table public.profiles drop column if exists nav_orientation;
alter table public.profiles drop column if exists bottom_nav_items;
alter table public.profiles drop column if exists main_nav_items;

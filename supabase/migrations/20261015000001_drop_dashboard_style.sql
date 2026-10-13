-- La dashboard ha un solo aspetto: la scelta dello stile non c'è più.
alter table public.profiles drop column if exists dashboard_style;

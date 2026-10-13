-- La pelle dello sblocco non si sceglie più: la decide il dispositivo (impronta se fidato, vetro altrimenti).
alter table public.profiles drop column if exists unlock_style;

-- L'elenco delle capsule ha un solo stile (l'oblò): la scelta non c'è più. L'effetto di apertura (capsule_open_effect) resta.
alter table public.profiles drop column if exists capsule_style;

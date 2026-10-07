alter table public.profiles
  add column dashboard_style text not null default 'classic'
  check (dashboard_style in ('classic', 'today', 'bento', 'stories', 'board'));

comment on column public.profiles.dashboard_style is 'Lo stile della Dashboard scelto in Impostazioni > Aspetto (v. lib/dashboard-style.ts): classic, today, bento, stories, board. In chiaro, come nav_orientation: una preferenza d''aspetto, non un dato del vault. Letta lato server con il resto del profilo, per evitare un lampo dello stile sbagliato.';

alter table public.profiles
  add column capsule_style text not null default 'envelope'
  check (capsule_style in ('envelope', 'flat', 'porthole'));

alter table public.profiles
  add column capsule_open_effect text not null default 'discreet'
  check (capsule_open_effect in ('zoom', 'hold', 'deck', 'light', 'discreet'));

comment on column public.profiles.capsule_style is 'Lo stile dell''elenco delle capsule scelto in Impostazioni > Aspetto > Capsule (v. lib/capsule-style.ts): envelope (buste), flat, porthole (oblò). In chiaro, come dashboard_style: una preferenza d''aspetto, non un dato del vault.';
comment on column public.profiles.capsule_open_effect is 'L''effetto di apertura proposto per default a chi crea una capsula (v. domain/capsules/open-effects.ts): zoom, hold, deck, light, discreet. L''effetto vero di ogni capsula sta nel suo payload cifrato (lo sceglie chi la scrive, per chi la riceve): qui solo il valore iniziale.';

alter table public.profiles
  add column onboarding_widget_hidden boolean not null default false;

comment on column public.profiles.onboarding_widget_hidden is 'Se il gadget "Onboarding" nella barra di navigazione è nascosto (v. "Nascondi" nel suo pannello). In chiaro, come nav_orientation: una preferenza d''aspetto, non un dato del vault. Sincronizzata sul server (non più solo localStorage) cosicché resti nascosto anche a un login successivo o su un altro dispositivo, finché non viene riattivata da Impostazioni > Onboarding.';

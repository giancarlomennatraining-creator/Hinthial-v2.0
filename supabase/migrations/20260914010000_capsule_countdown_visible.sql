alter table public.profiles
  add column capsule_countdown_visible boolean not null default true;

comment on column public.profiles.capsule_countdown_visible is 'Se il conto alla rovescia a cartellini verso l''apertura di una capsula (v. components/capsules/CapsuleCountdown.tsx) è mostrato in elenco/tabella/dettaglio, o nascosto del tutto (v. Impostazioni > Aspetto). In chiaro, come onboarding_widget_hidden: una preferenza d''aspetto, non un dato del vault. Sincronizzata sul server, non solo localStorage.';

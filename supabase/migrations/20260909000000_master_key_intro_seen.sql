alter table public.profiles
  add column master_key_intro_seen boolean not null default false;

comment on column public.profiles.master_key_intro_seen is 'Se il popup "Crea la tua master key" (mostrato una sola volta, subito dopo il login, finché la cifratura non è configurata) è già stato chiuso --- in chiaro, come onboarding_widget_hidden: una preferenza di questo account, non un dato del vault. Diventa irrilevante non appena la cifratura è configurata (il popup non si mostra più comunque), ma non viene ripulito: non serve, e ripristinarlo servirebbe solo a fare ricomparire un popup già visto.';

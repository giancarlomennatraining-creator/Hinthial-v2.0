alter table public.profiles
  add column unlock_style text not null default 'glass'
  check (unlock_style in ('glass', 'vault', 'fingerprint'));

comment on column public.profiles.unlock_style is 'Come si presenta la finestra di sblocco della master key, scelta in Impostazioni > Aspetto > Sblocco (v. lib/unlock-style.ts): glass (vetro), vault (cassaforte), fingerprint (impronta). In chiaro, come dashboard_style: una preferenza d''aspetto, non un dato del vault. Letta lato server con il resto del profilo.';

-- FASE 12 ("Eredità digitale", internamente Dead Man's Switch) ---
-- primo passo, solo i parametri numerici della strategia (v. richiesta
-- utente, discussi a fondo prima di scrivere qualunque riga di questa
-- migrazione): nessuna automazione reale ancora. Questi valori vengono
-- salvati, ma per ora non fanno succedere nulla da soli --- il
-- rilevamento dell'inattività, i promemoria, il coinvolgimento dei
-- guardiani e l'apertura delle capsule arriveranno in fasi successive,
-- che leggeranno questi stessi valori.
--
-- Colonne su profiles, come ogni altra preferenza semplice sincronizzata
-- sul server (v. nav_orientation, onboarding_widget_hidden) --- niente
-- tabella dedicata: sono valori singoli per account, non un elenco di
-- righe. I vincoli (check) impediscono configurazioni assurde anche in
-- modalità "custom" (es. una soglia di inattività di due giorni).
alter table public.profiles
  add column digital_legacy_preset text not null default 'balanced'
    check (digital_legacy_preset in ('cautious', 'balanced', 'relaxed', 'custom')),
  add column digital_legacy_inactivity_days integer not null default 120
    check (digital_legacy_inactivity_days between 30 and 730),
  add column digital_legacy_reminder_interval_days integer not null default 10
    check (digital_legacy_reminder_interval_days between 3 and 60),
  add column digital_legacy_reminder_count integer not null default 3
    check (digital_legacy_reminder_count between 1 and 10),
  add column digital_legacy_grace_period_days integer not null default 30
    check (digital_legacy_grace_period_days between 7 and 180),
  add column digital_legacy_guardian_quorum text not null default 'majority'
    check (digital_legacy_guardian_quorum in ('unanimous', 'majority', 'single')),
  add column digital_legacy_formal_verification_days integer not null default 14
    check (digital_legacy_formal_verification_days between 3 and 90),
  add column digital_legacy_final_wait_days integer not null default 14
    check (digital_legacy_final_wait_days between 3 and 90);

comment on column public.profiles.digital_legacy_preset is
  'Strategia scelta per "Eredità digitale" (FASE 12) --- "custom" quando uno o più valori sono stati modificati a mano rispetto a un preset. Solo configurazione per ora: nessuna automazione la legge ancora.';
comment on column public.profiles.digital_legacy_inactivity_days is
  'Giorni di inattività prima di iniziare i promemoria.';
comment on column public.profiles.digital_legacy_reminder_interval_days is
  'Ogni quanti giorni si ripete un promemoria.';
comment on column public.profiles.digital_legacy_reminder_count is
  'Quante volte viene ripetuto il promemoria prima del periodo di grazia.';
comment on column public.profiles.digital_legacy_grace_period_days is
  'Giorni del periodo di grazia, solo del proprietario, prima di coinvolgere i guardiani.';
comment on column public.profiles.digital_legacy_guardian_quorum is
  'Quanti guardiani devono confermare l''irraggiungibilità del proprietario prima di procedere.';
comment on column public.profiles.digital_legacy_formal_verification_days is
  'Giorni della verifica formale, dopo la conferma dei guardiani.';
comment on column public.profiles.digital_legacy_final_wait_days is
  'Giorni dell''attesa finale, prima dell''apertura effettiva delle capsule.';

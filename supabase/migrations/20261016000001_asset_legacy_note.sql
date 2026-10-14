-- "Cosa succede a questo bene": una nota, per ogni bene, su cosa fare se non ci sei più (a chi va, dove sono le chiavi,
-- chi chiamare). Cifrata con la Master Key come il nome: il server non la legge. Facoltativa: null = nessuna nota.
alter table public.assets
  add column encrypted_legacy_note text;

comment on column public.assets.encrypted_legacy_note is
  'Cosa succede a questo bene se il proprietario non c''è più, in prosa libera. Serializzato come EncryptedEnvelope, cifrato con la Master Key. Null se non scritta.';

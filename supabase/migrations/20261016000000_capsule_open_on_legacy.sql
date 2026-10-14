-- Eredità digitale: ogni capsula decide se, quando l'eredità digitale arriva alla consegna, si apre anche prima della sua data.
-- Prima, la consegna rendeva leggibili TUTTE le capsule già condivise (v. 20260917040000_digital_legacy_release.sql): una
-- capsula per una data lontana si apriva con le altre. Ora si apre prima solo se chi l'ha scritta l'ha chiesto.
--
-- In chiaro apposta, come open_at: il server deve poter decidere chi legge cosa senza decifrare nulla. Sa soltanto un sì o un
-- no per capsula; il contenuto resta cifrato.
alter table public.capsules
  add column open_on_legacy boolean not null default false;

comment on column public.capsules.open_on_legacy is
  'Se true, la capsula si apre ai destinatari anche prima di open_at quando "Eredità digitale" del proprietario arriva alla consegna (profiles.digital_legacy_triggered_at). Se false, solo a open_at. In chiaro, come open_at.';

-- Le capsule già chiuse o condivise mantengono la promessa di prima (si aprivano con la consegna): restano accese.
-- Le bozze partono spente: si sceglie alla chiusura.
update public.capsules set open_on_legacy = true where status in ('ready', 'shared');

-- Lettura delle chiavi della capsula: alla data, oppure alla consegna dell'eredità SE la capsula l'ha chiesto.
drop policy "capsule_share_keys_select_recipient_after_open" on public.capsule_share_keys;
create policy "capsule_share_keys_select_recipient_after_open"
  on public.capsule_share_keys for select
  to authenticated
  using (
    auth.uid() = recipient_user_id
    and exists (
      select 1
      from public.capsules c
      join public.profiles p on p.id = c.owner_id
      where c.id = capsule_share_keys.capsule_id
        and (
          (c.open_at is not null and c.open_at <= now())
          or (c.open_on_legacy and p.digital_legacy_triggered_at is not null)
        )
    )
  );

-- Stessa condizione per gli allegati in Storage: non basta negare la riga delle chiavi, va negato anche il blob cifrato.
drop policy "encrypted_capsules_select_shared_recipient" on storage.objects;
create policy "encrypted_capsules_select_shared_recipient"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'encrypted-capsules'
    and exists (
      select 1
      from public.capsule_shares cs
      join public.capsules c on c.id = cs.capsule_id
      join public.profiles p on p.id = c.owner_id
      where cs.recipient_user_id = auth.uid()
        and c.owner_id::text = (storage.foldername(name))[1]
        and c.id::text = (storage.foldername(name))[2]
        and (
          (c.open_at is not null and c.open_at <= now())
          or (c.open_on_legacy and p.digital_legacy_triggered_at is not null)
        )
    )
  );

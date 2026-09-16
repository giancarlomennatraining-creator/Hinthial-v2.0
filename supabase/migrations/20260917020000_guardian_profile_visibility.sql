-- Un guardiano deve poter leggere il NOME del proprietario per capire
-- chi gli sta chiedendo conferma (v. app/(app)/guardian-check/[requestId])
-- --- stesso schema già usato per "Condivise con me" (v. migrazione
-- capsule_shares, profiles_select_shared_by_owner): solo il nome, mai
-- altro, e solo quando esiste davvero una richiesta di verifica tra i due.
create policy "profiles_select_by_guardian"
  on public.profiles for select
  to authenticated
  using (exists (
    select 1 from public.guardian_verification_requests gvr
    where gvr.owner_id = profiles.id and gvr.guardian_user_id = auth.uid()
  ));

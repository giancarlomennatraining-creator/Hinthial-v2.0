-- Registrare la risposta di un guardiano nel registro Attività
-- DELL'ACCOUNT VERIFICATO (non del guardiano che risponde) richiede di
-- scrivere un evento con owner_id diverso da auth.uid() --- RLS lo
-- impedirebbe a un insert diretto (v. audit_events_insert_own). Stessa
-- soluzione già usata per log_failed_login_attempt: una funzione
-- SECURITY DEFINER puntuale, che ripete a mano il controllo che l'RLS
-- normalmente farebbe (guardian_user_id = auth.uid()) prima di
-- concedere l'update, invece di limitarsi a bypassarlo.
create or replace function public.respond_to_guardian_verification_request(request_id uuid, response_value text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_owner_id uuid;
begin
  update public.guardian_verification_requests
  set response = response_value, responded_at = now()
  where id = request_id and guardian_user_id = auth.uid()
  returning owner_id into target_owner_id;

  if target_owner_id is not null then
    insert into public.audit_events (owner_id, event_type)
    values (target_owner_id, 'digital_legacy_guardian_responded');
  end if;
end;
$$;

revoke all on function public.respond_to_guardian_verification_request(uuid, text) from public;
grant execute on function public.respond_to_guardian_verification_request(uuid, text) to authenticated;

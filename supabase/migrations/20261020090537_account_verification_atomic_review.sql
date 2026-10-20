-- Make verification review atomic and account-type aware.
create or replace function public.admin_review_verification(
  p_request_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_req public.verification_requests%rowtype;
  v_profile public.profiles%rowtype;
  v_requested_type text;
  v_now timestamptz := now();
  v_final_verified boolean;
  v_final_verification_status text;
begin
  if v_actor is null then
    raise exception 'authentication_required';
  end if;

  if not public.hayna_is_staff(v_actor) then
    raise exception 'admin_required';
  end if;

  if p_status not in ('approved', 'rejected') then
    raise exception 'invalid_verification_status';
  end if;

  select *
  into v_req
  from public.verification_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'verification_request_not_found';
  end if;

  if v_req.status <> 'pending' then
    raise exception 'verification_request_already_reviewed';
  end if;

  select *
  into v_profile
  from public.profiles
  where id = v_req.user_id
  for update;

  if not found then
    raise exception 'verification_profile_not_found';
  end if;

  v_requested_type := case
    when v_req.subject in ('standard', 'merchant', 'freelance', 'provider', 'idea')
      then v_req.subject
    when v_req.verification_type = 'identity'
      then 'standard'
    else null
  end;

  update public.verification_requests
  set status = p_status,
      reviewed_by = v_actor,
      reviewed_at = v_now
  where id = p_request_id;

  if p_status = 'approved' then
    update public.profiles
    set is_verified = true,
        verification_status = 'verified',
        verification_method = 'manual_review',
        account_type = coalesce(v_requested_type, account_type),
        is_verified_merchant = case
          when v_requested_type is null then is_verified_merchant
          else v_requested_type = 'merchant'
        end,
        freelance_trade = case
          when v_requested_type = 'standard' then null
          when v_requested_type is not null then nullif(btrim(v_req.note), '')
          else freelance_trade
        end,
        updated_at = v_now
    where id = v_req.user_id;

    insert into public.profile_badges(user_id, badge_code, awarded_by)
    values(v_req.user_id, 'trusted', v_actor)
    on conflict (user_id, badge_code)
    do update set awarded_by = excluded.awarded_by;

    v_final_verified := true;
    v_final_verification_status := 'verified';
  else
    update public.profiles
    set verification_status = case
          when is_verified then 'verified'
          else 'rejected'
        end,
        updated_at = v_now
    where id = v_req.user_id;

    v_final_verified := v_profile.is_verified;
    v_final_verification_status := case
      when v_profile.is_verified then 'verified'
      else 'rejected'
    end;
  end if;

  insert into public.admin_activity_logs(
    actor_id,
    action,
    target_type,
    target_id,
    metadata
  )
  values(
    v_actor,
    'verification_' || p_status,
    'verification',
    p_request_id,
    jsonb_build_object(
      'user_id', v_req.user_id,
      'status', p_status,
      'requested_account_type', v_requested_type
    )
  );

  return jsonb_build_object(
    'request_id', p_request_id,
    'user_id', v_req.user_id,
    'status', p_status,
    'requested_account_type', v_requested_type,
    'account_type', case
      when p_status = 'approved' then coalesce(v_requested_type, v_profile.account_type)
      else v_profile.account_type
    end,
    'is_verified', v_final_verified,
    'is_verified_merchant', case
      when p_status = 'approved' and v_requested_type is not null
        then v_requested_type = 'merchant'
      else v_profile.is_verified_merchant
    end,
    'verification_status', v_final_verification_status,
    'reviewed_by', v_actor,
    'reviewed_at', v_now
  );
end;
$$;

revoke all on function public.admin_review_verification(uuid, text) from public;
revoke all on function public.admin_review_verification(uuid, text) from anon;
grant execute on function public.admin_review_verification(uuid, text) to authenticated;

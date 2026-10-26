-- Clients must select explicit fields; contact numbers live behind their own RLS.
revoke select on public.profiles from public, anon, authenticated;
revoke select (phone, totp_secret, national_address_code) on public.profiles from public, anon, authenticated;
grant select (id,username,display_name,city,district,bio,avatar_url,is_verified,created_at,updated_at,role,verification_status,profile_privacy,allow_dms,allow_story_replies,is_geoverified,geoverified_at,hide_name,dnd_enabled,muted_conversations,region_id,city_id,district_id,dnd_schedule,dnd_start,dnd_end,region,is_banned,username_last_changed_at,is_verified_neighbor,verification_method,badges,totp_enabled,admin_session_expires_at,failed_login_attempts,last_failed_login_at,password_changed_at,notifications_unread_count,services_count,requests_count,reports_count,questions_count,answers_count,show_in_search,last_active_at,account_type,freelance_trade,is_verified_merchant) on public.profiles to anon, authenticated;

-- Preserve invoker behavior for business workflows without selecting private columns.
CREATE OR REPLACE FUNCTION public.admin_review_verification(p_request_id uuid, p_status text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$;
declare
  v_actor uuid := auth.uid();
  v_req public.verification_requests%rowtype;
  v_profile record;
  v_requested_type text;
  v_now timestamptz := now();
  v_final_verified boolean;
  v_final_verification_status text;
begin
 perform public.assert_is_admin();
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

  select id,username,display_name,city,district,bio,avatar_url,is_verified,created_at,updated_at,role,verification_status,profile_privacy,allow_dms,allow_story_replies,is_geoverified,geoverified_at,hide_name,dnd_enabled,muted_conversations,region_id,city_id,district_id,dnd_schedule,dnd_start,dnd_end,region,is_banned,username_last_changed_at,is_verified_neighbor,verification_method,badges,totp_enabled,admin_session_expires_at,failed_login_attempts,last_failed_login_at,password_changed_at,notifications_unread_count,services_count,requests_count,reports_count,questions_count,answers_count,show_in_search,last_active_at,account_type,freelance_trade,is_verified_merchant
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
$function$;


CREATE OR REPLACE FUNCTION public.hayna_ensure_my_business()
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$;
declare
  v_uid uuid := auth.uid();
  v_profile record;
  v_business_id uuid;
begin
  if v_uid is null then
    raise exception 'authentication_required';
  end if;

  select id,username,display_name,city,district,bio,avatar_url,is_verified,created_at,updated_at,role,verification_status,profile_privacy,allow_dms,allow_story_replies,is_geoverified,geoverified_at,hide_name,dnd_enabled,muted_conversations,region_id,city_id,district_id,dnd_schedule,dnd_start,dnd_end,region,is_banned,username_last_changed_at,is_verified_neighbor,verification_method,badges,totp_enabled,admin_session_expires_at,failed_login_attempts,last_failed_login_at,password_changed_at,notifications_unread_count,services_count,requests_count,reports_count,questions_count,answers_count,show_in_search,last_active_at,account_type,freelance_trade,is_verified_merchant
  into v_profile
  from public.profiles
  where id = v_uid;

  if not found then
    raise exception 'profile_not_found';
  end if;

  if not (
    v_profile.role = 'admin'
    or (v_profile.is_verified and v_profile.account_type = 'merchant')
  ) then
    raise exception 'merchant_account_required' using errcode = '42501';
  end if;

  select id into v_business_id
  from public.businesses
  where owner_id = v_uid
  limit 1;

  if v_business_id is not null then
    update public.businesses
    set name = coalesce(nullif(btrim(v_profile.freelance_trade), ''), v_profile.display_name),
        city = coalesce(nullif(btrim(v_profile.city), ''), city, 'غير محدد'),
        district = coalesce(nullif(btrim(v_profile.district), ''), district),
        updated_at = now()
    where id = v_business_id;
    return v_business_id;
  end if;

  insert into public.businesses(
    owner_id, name, description, city, district,
    is_verified, moderation_status
  )
  values(
    v_uid,
    coalesce(nullif(btrim(v_profile.freelance_trade), ''), v_profile.display_name),
    'الصفحة التجارية الرسمية لهذا الحساب في حيّنا.',
    coalesce(nullif(btrim(v_profile.city), ''), 'غير محدد'),
    nullif(btrim(v_profile.district), ''),
    true,
    'approved'
  )
  returning id into v_business_id;

  return v_business_id;
end;
$function$;


notify pgrst, 'reload schema';


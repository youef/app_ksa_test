-- Secure account verification flow
-- Applied to Supabase production as migration 20261020085604.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'verification-documents',
  'verification-documents',
  false,
  8388608,
  array['image/jpeg','image/png','image/webp','image/heic']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

alter table public.verification_requests enable row level security;

drop policy if exists "Admins and owners can view verification requests" on public.verification_requests;
drop policy if exists "Users can insert their own verification requests." on public.verification_requests;
drop policy if exists "Users can submit own verification" on public.verification_requests;
drop policy if exists "Users can view their own verification requests." on public.verification_requests;
drop policy if exists "admin_verif_select" on public.verification_requests;
drop policy if exists "admin_verif_update" on public.verification_requests;
drop policy if exists "verif_insert" on public.verification_requests;
drop policy if exists "verif_select" on public.verification_requests;
drop policy if exists "verification own insert" on public.verification_requests;

create policy "verification_requests_select_own_or_staff"
on public.verification_requests
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or public.hayna_is_staff((select auth.uid()))
);

create policy "verification_requests_insert_own_pending"
on public.verification_requests
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and status = 'pending'
  and reviewed_by is null
  and reviewed_at is null
);

create policy "verification_requests_update_staff"
on public.verification_requests
for update
to authenticated
using (public.hayna_is_staff((select auth.uid())))
with check (public.hayna_is_staff((select auth.uid())));

create policy "verification_requests_delete_staff"
on public.verification_requests
for delete
to authenticated
using (public.hayna_is_staff((select auth.uid())));

drop policy if exists "verification_docs_select_owner_or_staff" on storage.objects;
drop policy if exists "verification_docs_insert_owner" on storage.objects;
drop policy if exists "verification_docs_delete_owner_or_staff" on storage.objects;

create policy "verification_docs_select_owner_or_staff"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'verification-documents'
  and (
    (storage.foldername(name))[1] = ((select auth.uid()))::text
    or public.hayna_is_staff((select auth.uid()))
  )
);

create policy "verification_docs_insert_owner"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'verification-documents'
  and (storage.foldername(name))[1] = ((select auth.uid()))::text
);

create policy "verification_docs_delete_owner_or_staff"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'verification-documents'
  and (
    (storage.foldername(name))[1] = ((select auth.uid()))::text
    or public.hayna_is_staff((select auth.uid()))
  )
);

create or replace function public.guard_profile_sensitive_fields()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  request_user uuid := auth.uid();
  is_staff boolean := false;
begin
  if request_user is null then
    return new;
  end if;

  is_staff := public.hayna_is_staff(request_user);
  if is_staff then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.is_verified is distinct from old.is_verified
     or new.is_verified_merchant is distinct from old.is_verified_merchant
     or new.is_geoverified is distinct from old.is_geoverified
     or new.is_verified_neighbor is distinct from old.is_verified_neighbor
     or new.is_banned is distinct from old.is_banned
     or new.verification_method is distinct from old.verification_method
     or new.verification_status is distinct from old.verification_status
     or (
       new.account_type is distinct from old.account_type
       and new.account_type <> 'standard'
     )
  then
    raise exception 'sensitive_profile_fields_require_admin_review'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_profile_sensitive_fields on public.profiles;
create trigger guard_profile_sensitive_fields
before update of
  role,
  is_verified,
  is_verified_merchant,
  is_geoverified,
  is_verified_neighbor,
  is_banned,
  verification_method,
  verification_status,
  account_type
on public.profiles
for each row
execute function public.guard_profile_sensitive_fields();

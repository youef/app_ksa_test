-- Applied to Supabase production as 20261027052336.
-- Users may submit a document reference for human review after visiting the free
-- official Ministry of Commerce or Freelance.sa verification portals.
-- A document number is NEVER itself proof of government verification or ownership.
alter table public.verification_requests
  add column if not exists document_number text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.verification_requests'::regclass
      and conname = 'verification_requests_document_number_format'
  ) then
    alter table public.verification_requests
      add constraint verification_requests_document_number_format
      check (
        document_number is null
        or (
          verification_type in ('business', 'freelance')
          and char_length(document_number) between 6 and 30
          and document_number ~ '^[A-Za-z0-9-]+$'
        )
      );
  end if;
end $$;

create unique index if not exists idx_verification_requests_pending_official
on public.verification_requests (user_id, verification_type)
where status = 'pending' and document_number is not null;

comment on column public.verification_requests.document_number is
'Private user-supplied document reference; NOT proof of government validation. Approval requires staff to check official source and claimant authority.';

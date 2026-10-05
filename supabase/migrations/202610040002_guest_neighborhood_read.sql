create or replace function public.hayna_guest_questions(
  p_city text,
  p_district text,
  p_limit integer default 30
)
returns setof public.questions
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select q.*
  from public.questions q
  where auth.uid() is null
    and nullif(btrim(p_city), '') is not null
    and (
      public.hayna_location_key(p_city) in (
        public.hayna_location_key('كل المدن'),
        public.hayna_location_key('كل المملكة'),
        public.hayna_location_key('الكل'),
        public.hayna_location_key('جميع المدن')
      )
      or (
        public.hayna_location_key(q.city) = public.hayna_location_key(p_city)
        and (
          nullif(btrim(p_district), '') is null
          or public.hayna_location_key(p_district) in (
            public.hayna_location_key('كل الأحياء'),
            public.hayna_location_key('كل أحياء المدينة')
          )
          or public.hayna_location_key(q.district) = public.hayna_location_key(p_district)
        )
      )
    )
  order by q.created_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

create or replace function public.hayna_guest_requests(
  p_city text,
  p_district text,
  p_limit integer default 30
)
returns setof public.requests
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select r.*
  from public.requests r
  where auth.uid() is null
    and r.status = 'open'
    and nullif(btrim(p_city), '') is not null
    and (
      public.hayna_location_key(p_city) in (
        public.hayna_location_key('كل المدن'),
        public.hayna_location_key('كل المملكة'),
        public.hayna_location_key('الكل'),
        public.hayna_location_key('جميع المدن')
      )
      or (
        public.hayna_location_key(r.city) = public.hayna_location_key(p_city)
        and (
          nullif(btrim(p_district), '') is null
          or public.hayna_location_key(p_district) in (
            public.hayna_location_key('كل الأحياء'),
            public.hayna_location_key('كل أحياء المدينة')
          )
          or public.hayna_location_key(r.district) = public.hayna_location_key(p_district)
        )
      )
    )
  order by r.created_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

create or replace function public.hayna_guest_question(
  p_id uuid,
  p_city text,
  p_district text
)
returns setof public.questions
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select q.*
  from public.questions q
  where auth.uid() is null
    and (
      public.hayna_location_key(p_city) in (
        public.hayna_location_key('كل المدن'),
        public.hayna_location_key('كل المملكة'),
        public.hayna_location_key('الكل'),
        public.hayna_location_key('جميع المدن')
      )
      or (
        public.hayna_location_key(q.city) = public.hayna_location_key(p_city)
        and (
          public.hayna_location_key(p_district) in (
            public.hayna_location_key('كل الأحياء'),
            public.hayna_location_key('كل أحياء المدينة')
          )
          or public.hayna_location_key(q.district) = public.hayna_location_key(p_district)
        )
      )
    )
    and q.id = p_id
  limit 1;
$$;

create or replace function public.hayna_guest_request(
  p_id uuid,
  p_city text,
  p_district text
)
returns setof public.requests
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select r.*
  from public.requests r
  where auth.uid() is null
    and (
      public.hayna_location_key(p_city) in (
        public.hayna_location_key('كل المدن'),
        public.hayna_location_key('كل المملكة'),
        public.hayna_location_key('الكل'),
        public.hayna_location_key('جميع المدن')
      )
      or (
        public.hayna_location_key(r.city) = public.hayna_location_key(p_city)
        and (
          public.hayna_location_key(p_district) in (
            public.hayna_location_key('كل الأحياء'),
            public.hayna_location_key('كل أحياء المدينة')
          )
          or public.hayna_location_key(r.district) = public.hayna_location_key(p_district)
        )
      )
    )
    and r.id = p_id
  limit 1;
$$;

revoke all on function public.hayna_guest_questions(text, text, integer) from public, authenticated;
revoke all on function public.hayna_guest_requests(text, text, integer) from public, authenticated;
revoke all on function public.hayna_guest_question(uuid, text, text) from public, authenticated;
revoke all on function public.hayna_guest_request(uuid, text, text) from public, authenticated;
grant execute on function public.hayna_guest_questions(text, text, integer) to anon;
grant execute on function public.hayna_guest_requests(text, text, integer) to anon;
grant execute on function public.hayna_guest_question(uuid, text, text) to anon;
grant execute on function public.hayna_guest_request(uuid, text, text) to anon;

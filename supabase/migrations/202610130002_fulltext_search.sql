-- ============================================================
-- Full-text search (Arabic + English) for questions, services, requests
-- ============================================================
-- Enable pg_trgm for trigram similarity (optional but helpful)
create extension if not exists pg_trgm;

-- ============================================================
-- 1) QUESTIONS
-- ============================================================
alter table public.questions
  add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('arabic', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('arabic', coalesce(body, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(city, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(district, '')), 'C')
  ) stored;

create index if not exists questions_search_vector_idx
  on public.questions using gin (search_vector);

-- Trigger to keep it updated (redundant with generated column but safe for older PG)
create or replace function public.tg_questions_search_vector()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  NEW.search_vector :=
    setweight(to_tsvector('arabic', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('arabic', coalesce(NEW.body, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.city, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(NEW.district, '')), 'C');
  return NEW;
end;
$$;

drop trigger if exists tg_questions_search_vector on public.questions;
create trigger tg_questions_search_vector
before insert or update on public.questions
for each row execute function public.tg_questions_search_vector();

-- ============================================================
-- 2) SERVICES
-- ============================================================
alter table public.services
  add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('arabic', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('arabic', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(category, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(subcategory, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(city, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(district, '')), 'C')
  ) stored;

create index if not exists services_search_vector_idx
  on public.services using gin (search_vector);

create or replace function public.tg_services_search_vector()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  NEW.search_vector :=
    setweight(to_tsvector('arabic', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('arabic', coalesce(NEW.description, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.category, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(NEW.subcategory, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(NEW.city, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(NEW.district, '')), 'C');
  return NEW;
end;
$$;

drop trigger if exists tg_services_search_vector on public.services;
create trigger tg_services_search_vector
before insert or update on public.services
for each row execute function public.tg_services_search_vector();

-- ============================================================
-- 3) REQUESTS
-- ============================================================
alter table public.requests
  add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('arabic', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('arabic', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(category, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(city, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(district, '')), 'C')
  ) stored;

create index if not exists requests_search_vector_idx
  on public.requests using gin (search_vector);

create or replace function public.tg_requests_search_vector()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  NEW.search_vector :=
    setweight(to_tsvector('arabic', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('arabic', coalesce(NEW.description, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.category, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(NEW.city, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(NEW.district, '')), 'C');
  return NEW;
end;
$$;

drop trigger if exists tg_requests_search_vector on public.requests;
create trigger tg_requests_search_vector
before insert or update on public.requests
for each row execute function public.tg_requests_search_vector();

-- ============================================================
-- 4) Unified search RPC (used by AdminGlobalSearch)
-- ============================================================
create or replace function public.admin_global_search(
  p_query text,
  p_limit int default 20
)
returns table (
  type text,
  id uuid,
  title text,
  subtitle text,
  city text,
  district text,
  created_at timestamptz,
  rank real
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tsquery text;
begin
  -- Sanitize and build tsquery
  v_tsquery := regexp_replace(p_query, '[^\p{L}\p{N}\s]', '', 'g');
  v_tsquery := regexp_replace(v_tsquery, '\s+', ' & ', 'g');
  if v_tsquery = '' then
    return;
  end if;

  return query
  select * from (
    -- Questions
    select
      'question'::text as type,
      q.id,
      q.title,
      q.body as subtitle,
      q.city,
      q.district,
      q.created_at,
      ts_rank_cd(q.search_vector, to_tsquery('arabic', v_tsquery)) as rank
    from public.questions q
    where q.search_vector @@ to_tsquery('arabic', v_tsquery)

    union all

    -- Services
    select
      'service'::text,
      s.id,
      s.name as title,
      s.description as subtitle,
      s.city,
      s.district,
      s.created_at,
      ts_rank_cd(s.search_vector, to_tsquery('arabic', v_tsquery)) as rank
    from public.services s
    where s.search_vector @@ to_tsquery('arabic', v_tsquery)

    union all

    -- Requests
    select
      'request'::text,
      r.id,
      r.title,
      r.description as subtitle,
      r.city,
      r.district,
      r.created_at,
      ts_rank_cd(r.search_vector, to_tsquery('arabic', v_tsquery)) as rank
    from public.requests r
    where r.search_vector @@ to_tsquery('arabic', v_tsquery)
  ) combined
  order by rank desc
  limit p_limit;
end;
$$;

grant execute on function public.admin_global_search(text, int) to anon, authenticated, service_role;

-- ============================================================
-- 5) Trigram similarity indexes (for fuzzy fallback)
-- ============================================================
create index if not exists questions_title_trgm_idx
  on public.questions using gin (title gin_trgm_ops);
create index if not exists services_name_trgm_idx
  on public.services using gin (name gin_trgm_ops);
create index if not exists requests_title_trgm_idx
  on public.requests using gin (title gin_trgm_ops);
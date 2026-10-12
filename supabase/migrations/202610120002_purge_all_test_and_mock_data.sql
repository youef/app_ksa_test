-- Migration: 202610120002_purge_all_test_and_mock_data.sql
-- Description: Complete purge of all fake/test accounts (arar_001 to arar_080)
-- and test posts, test services, test requests, test stories, and test conversations.
-- Also permanently prevents any background generator from creating auto-suggested or test data.

-- ============================================================
-- 1. Helper function to purge all test data with security definer
-- ============================================================
create or replace function public.admin_purge_test_data()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_fake_user_ids uuid[];
  v_deleted_stories int := 0;
  v_deleted_matches int := 0;
  v_deleted_follows int := 0;
  v_deleted_answers int := 0;
  v_deleted_questions int := 0;
  v_deleted_requests int := 0;
  v_deleted_services int := 0;
  v_deleted_profiles int := 0;
  v_deleted_messages int := 0;
begin
  -- 1. Identify all 80 seeded fake test profiles
  select coalesce(array_agg(id), '{}') into v_fake_user_ids
  from public.profiles
  where username ilike 'arar_%'
     or display_name ilike 'مستخدم عرعر%';

  -- 2. Delete test stories (gibberish/test entries)
  delete from public.stories
  where content in ('hf', 'fgf', 'test', 'تجربة')
     or (author_id is not null and author_id = any(v_fake_user_ids));
  get diagnostics v_deleted_stories = row_count;

  -- 3. Delete test help_matches (single letter / test messages)
  delete from public.help_matches
  where message in ('ا', 't', 'test')
     or message ilike 'اقتراح تلقائي%'
     or message ilike 'اقتراح تلقائى%'
     or helper_id = any(v_fake_user_ids);
  get diagnostics v_deleted_matches = row_count;

  -- 4. Delete follows involving fake test users
  delete from public.follows
  where follower_id = any(v_fake_user_ids)
     or following_id = any(v_fake_user_ids);
  get diagnostics v_deleted_follows = row_count;

  -- 5. Delete answers by fake test users
  delete from public.answers
  where author_id = any(v_fake_user_ids);
  get diagnostics v_deleted_answers = row_count;

  -- 6. Delete test questions
  delete from public.questions
  where author_id = any(v_fake_user_ids)
     or title in ('تنتن', 'نمنم', 'opo', 'مك', 'نت', 'Cch', 'Mdm', 'وة', 'هخ', 'asdf', '123')
     or body ilike '%سؤال تجريبي%'
     or title ilike '%Paragominas%';
  get diagnostics v_deleted_questions = row_count;

  -- 7. Delete test requests
  delete from public.requests
  where requester_id = any(v_fake_user_ids)
     or title like 'طلب مساعدة من الحي رقم %'
     or title in ('ات', 'ععه')
     or description ilike '%طلب تجريبي%';
  get diagnostics v_deleted_requests = row_count;

  -- 8. Delete test services
  delete from public.services
  where provider_id = any(v_fake_user_ids)
     or name like 'خدمة منزلية رقم %'
     or name in ('غففغ', 'فصثل');
  get diagnostics v_deleted_services = row_count;

  -- 9. Delete messages and conversations involving fake test users
  delete from public.messages
  where sender_id = any(v_fake_user_ids);
  get diagnostics v_deleted_messages = row_count;

  -- 10. Delete the 80 fake test profiles
  delete from public.profiles
  where id = any(v_fake_user_ids);
  get diagnostics v_deleted_profiles = row_count;

  return jsonb_build_object(
    'success', true,
    'deleted_profiles', v_deleted_profiles,
    'deleted_services', v_deleted_services,
    'deleted_requests', v_deleted_requests,
    'deleted_questions', v_deleted_questions,
    'deleted_answers', v_deleted_answers,
    'deleted_follows', v_deleted_follows,
    'deleted_stories', v_deleted_stories,
    'deleted_matches', v_deleted_matches,
    'deleted_messages', v_deleted_messages
  );
end;
$$;

-- Grant execution to authenticated users and service
grant execute on function public.admin_purge_test_data() to authenticated;
grant execute on function public.admin_purge_test_data() to anon;

-- ============================================================
-- 2. Immediate execution of the purge function
-- ============================================================
select public.admin_purge_test_data();

-- ============================================================
-- 3. Permanent Guard: Block any automated test/dummy suggestions
-- ============================================================
create or replace function app_private.block_auto_suggested_offers()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.message is not null
     and (
       new.message ilike 'اقتراح تلقائي%'
       or new.message ilike 'اقتراح تلقائى%'
       or new.message in ('test', 'تجربة', 'تست')
     ) then
    return null; -- Silently drop automated/test offer
  end if;
  return new;
end;
$$;

drop trigger if exists trg_block_auto_suggested_offers on public.help_matches;
create trigger trg_block_auto_suggested_offers
  before insert or update on public.help_matches
  for each row execute function app_private.block_auto_suggested_offers();

-- Disable any legacy server-side auto matcher triggers on public.requests
do $$
declare
  r record;
begin
  for r in
    select t.tgname as trigger_name
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_proc p on p.oid = t.tgfoid
    where n.nspname = 'public'
      and c.relname = 'requests'
      and not t.tgisinternal
      and pg_get_functiondef(p.oid) ilike '%help_matches%'
  loop
    execute format('alter table public.requests disable trigger %I', r.trigger_name);
  end loop;
end $$;

notify pgrst, 'reload schema';

-- ============================================================
-- Categories management (hierarchical, for market/services/requests)
-- ============================================================

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories(id) on delete set null,
  key text not null unique,
  label text not null,
  description text,
  icon text,
  color text,
  sort_order int not null default 0,
  entity_types text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists categories_parent_idx on public.categories (parent_id);
create index if not exists categories_entity_types_idx on public.categories using gin (entity_types);

alter table public.categories enable row level security;

drop policy if exists categories_read on public.categories;
create policy categories_read on public.categories
  for select using (is_active = true);

drop policy if exists categories_admin_write on public.categories;
create policy categories_admin_write on public.categories
  for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create or replace function public.tg_categories_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$;

drop trigger if exists tg_categories_updated_at on public.categories;
create trigger tg_categories_updated_at
before update on public.categories
for each row execute function public.tg_categories_updated_at();

-- Seed Level 1 categories (idempotent)
insert into public.categories (key, label, description, icon, color, sort_order, entity_types, parent_id) values
  ('home_maintenance', 'صيانة منزلية', 'خدمات الصيانة والإصلاح للمنازل', 'Wrench', '#2563EB', 10, '{"services","requests"}', null),
  ('electronics', 'إلكترونيات', 'أجهزة، جوالات، وملحقاتها', 'Smartphone', '#7C3AED', 20, '{"services","market","requests"}', null),
  ('transport', 'نقل ومواصلات', 'توصيل، نقل أثاث، ركوب مشترك', 'Truck', '#059669', 30, '{"services","requests","carpooling"}', null),
  ('beauty_health', 'جمال وصحة', 'صالونات، عناية شخصية، تمريض منزلي', 'Heart', '#DB2777', 40, '{"services","market"}', null),
  ('education', 'تعليم وتدريب', 'دروس خصوصية، دورات، استشارات', 'GraduationCap', '#EA580C', 50, '{"services","requests"}', null),
  ('events', 'مناسبات وفعاليات', 'تصوير، ضيافة، تنظيم حفلات', 'Calendar', '#0891B2', 60, '{"services","requests"}', null),
  ('professional', 'خدمات مهنية', 'محاسبة، قانون، ترجمة، تصميم', 'Briefcase', '#4338CA', 70, '{"services","requests"}', null),
  ('automotive', 'سيارات', 'صيانة، غسيل، قطع غيار', 'Car', '#1F2937', 80, '{"services","market","requests"}', null),
  ('pets', 'حيوانات أليفة', 'رعاية، تدريب، مستلزمات', 'Bone', '#F59E0B', 90, '{"services","market"}', null),
  ('other', 'أخرى', 'خدمات وطلبات متنوعة', 'MoreHorizontal', '#6B7280', 100, '{"services","market","requests"}', null)
on conflict (key) do update set
  label = excluded.label,
  description = excluded.description,
  icon = excluded.icon,
  color = excluded.color,
  sort_order = excluded.sort_order,
  entity_types = excluded.entity_types,
  is_active = excluded.is_active,
  updated_at = now();

-- Seed Level 2 categories - use DO block to ensure parent IDs exist
do $$
declare
  v_home uuid;
  v_electronics uuid;
  v_transport uuid;
begin
  select id into v_home from public.categories where key = 'home_maintenance';
  select id into v_electronics from public.categories where key = 'electronics';
  select id into v_transport from public.categories where key = 'transport';

  if v_home is not null then
    insert into public.categories (key, label, description, icon, color, sort_order, entity_types, parent_id) values
      ('ac_repair', 'صيانة تكييف', 'تركيب وصيانة المكيفات', 'Snowflake', '#2563EB', 10, '{"services","requests"}', v_home),
      ('plumbing', 'سباكة', 'إصلاح التسريبات وتركيب الأدوات الصحية', 'Droplets', '#2563EB', 20, '{"services","requests"}', v_home),
      ('electrical', 'كهرباء', 'تمديدات، مفاتيح، إضاءة', 'Zap', '#2563EB', 30, '{"services","requests"}', v_home),
      ('carpentry', 'نجارة', 'أبواب، نوافذ، أثاث مخصص', 'Hammer', '#2563EB', 40, '{"services","requests"}', v_home),
      ('painting', 'دهانات وديكور', 'دهان داخلي/خارجي، ورق جدران', 'Brush', '#2563EB', 50, '{"services","requests"}', v_home)
    on conflict (key) do update set
      label = excluded.label, description = excluded.description, icon = excluded.icon,
      color = excluded.color, sort_order = excluded.sort_order, entity_types = excluded.entity_types,
      parent_id = excluded.parent_id, updated_at = now();
  end if;

  if v_electronics is not null then
    insert into public.categories (key, label, description, icon, color, sort_order, entity_types, parent_id) values
      ('phone_repair', 'إصلاح جوالات', 'شاشات، بطاريات، منافذ شحن', 'Smartphone', '#7C3AED', 10, '{"services","market","requests"}', v_electronics),
      ('computer_repair', 'إصلاح حواسيب', 'صيانة لابتوب/ديسكتوب', 'Monitor', '#7C3AED', 20, '{"services","requests"}', v_electronics),
      ('accessories', 'إكسسوارات', 'سماعات، شواحن، جرابات', 'Headphones', '#7C3AED', 30, '{"market","requests"}', v_electronics)
    on conflict (key) do update set
      label = excluded.label, description = excluded.description, icon = excluded.icon,
      color = excluded.color, sort_order = excluded.sort_order, entity_types = excluded.entity_types,
      parent_id = excluded.parent_id, updated_at = now();
  end if;

  if v_transport is not null then
    insert into public.categories (key, label, description, icon, color, sort_order, entity_types, parent_id) values
      ('delivery', 'توصيل طلبات', 'طعام، مستلزمات، وثائق', 'Package', '#059669', 10, '{"services","requests","carpooling"}', v_transport),
      ('moving', 'نقل أثاث', 'نقل منزلي/مكتبي مع تغليف', 'Package', '#059669', 20, '{"services","requests"}', v_transport),
      ('carpooling_cat', 'ركوب مشترك', 'تنقل يومي بين الأحياء', 'Users', '#059669', 30, '{"carpooling","requests"}', v_transport)
    on conflict (key) do update set
      label = excluded.label, description = excluded.description, icon = excluded.icon,
      color = excluded.color, sort_order = excluded.sort_order, entity_types = excluded.entity_types,
      parent_id = excluded.parent_id, updated_at = now();
  end if;
end;
$$;

-- RPC to get full category tree (for admin UI)
create or replace function public.get_category_tree(p_entity_type text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  with recursive cat_tree as (
    select id, key, label, description, icon, color, sort_order, entity_types, parent_id,
           0 as level,
           jsonb_build_object(
             'id', id, 'key', key, 'label', label, 'description', description,
             'icon', icon, 'color', color, 'sort_order', sort_order,
             'entity_types', entity_types, 'children', '[]'::jsonb
           ) as node
    from public.categories
    where parent_id is null
      and is_active = true
      and (p_entity_type is null or entity_types @> array[p_entity_type]::text[])

    union all

    select c.id, c.key, c.label, c.description, c.icon, c.color, c.sort_order, c.entity_types, c.parent_id,
           ct.level + 1,
           jsonb_build_object(
             'id', c.id, 'key', c.key, 'label', c.label, 'description', c.description,
             'icon', c.icon, 'color', c.color, 'sort_order', c.sort_order,
             'entity_types', c.entity_types, 'children', '[]'::jsonb
           )
    from public.categories c
    join cat_tree ct on c.parent_id = ct.id
    where c.is_active = true
      and (p_entity_type is null or c.entity_types @> array[p_entity_type]::text[])
  )
  select jsonb_agg(node order by sort_order) into v_result
  from cat_tree
  where level = 0;

  return coalesce(v_result, '[]'::jsonb);
end;
$$;

grant execute on function public.get_category_tree(text) to anon, authenticated, service_role;
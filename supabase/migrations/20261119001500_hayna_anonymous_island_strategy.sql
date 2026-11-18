-- ممالك حيّنا: original anonymous island strategy game.
-- Resource accounting, matchmaking, cooldowns and combat are server-authoritative.
create table if not exists public.hayna_game_captains (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  alias text not null unique default ('قائد-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 7))),
  gold integer not null default 330 check (gold between 0 and 100000),
  timber integer not null default 250 check (timber between 0 and 100000),
  food integer not null default 220 check (food between 0 and 100000),
  troops integer not null default 18 check (troops between 0 and 500),
  fortress integer not null default 18 check (fortress between 0 and 400),
  level integer not null default 1 check (level between 1 and 25),
  trophies integer not null default 100 check (trophies between 0 and 100000),
  wins integer not null default 0,
  losses integer not null default 0,
  last_collected_at timestamptz not null default (now() - interval '20 minutes'),
  last_attack_at timestamptz,
  shield_until timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists hayna_game_captains_trophies_idx on public.hayna_game_captains (trophies desc, wins desc);
create index if not exists hayna_game_captains_shield_idx on public.hayna_game_captains (shield_until);

create table if not exists public.hayna_game_battles (
  id uuid primary key default gen_random_uuid(),
  attacker_id uuid not null references public.hayna_game_captains(id) on delete cascade,
  defender_id uuid references public.hayna_game_captains(id) on delete cascade,
  versus_pirates boolean not null default false,
  attacker_won boolean not null,
  gold_loot integer not null default 0 check (gold_loot >= 0),
  timber_loot integer not null default 0 check (timber_loot >= 0),
  lost_troops integer not null default 0 check (lost_troops >= 0),
  created_at timestamptz not null default now(),
  check ((versus_pirates and defender_id is null) or (not versus_pirates and defender_id is not null))
);
create index if not exists hayna_game_battles_attacker_idx on public.hayna_game_battles (attacker_id, created_at desc);
create index if not exists hayna_game_battles_defender_idx on public.hayna_game_battles (defender_id, created_at desc);

alter table public.hayna_game_captains enable row level security;
alter table public.hayna_game_battles enable row level security;
revoke all on public.hayna_game_captains from public, anon, authenticated;
revoke all on public.hayna_game_battles from public, anon, authenticated;
grant select on public.hayna_game_captains to authenticated;
grant select on public.hayna_game_battles to authenticated;

create policy "captains read their own island"
on public.hayna_game_captains for select to authenticated
using ((select auth.uid()) = user_id);

create policy "captains read own battle outcomes"
on public.hayna_game_battles for select to authenticated
using (attacker_id in (select id from public.hayna_game_captains where user_id = (select auth.uid()))
    or defender_id in (select id from public.hayna_game_captains where user_id = (select auth.uid())));

create or replace function public.hayna_game_state()
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_me public.hayna_game_captains%rowtype;
  v_leaders jsonb;
  v_targets jsonb;
  v_history jsonb;
  v_rank integer;
begin
  if v_user is null then raise exception 'سجّل الدخول أولًا'; end if;
  select * into v_me from public.hayna_game_captains where user_id = v_user;
  if not found then return jsonb_build_object('joined', false); end if;

  select count(*)::integer + 1 into v_rank
  from public.hayna_game_captains c
  where c.trophies > v_me.trophies
     or (c.trophies = v_me.trophies and c.wins > v_me.wins);

  select coalesce(jsonb_agg(to_jsonb(t) order by t.trophies desc, t.wins desc), '[]'::jsonb)
    into v_leaders from (
      select alias, level, trophies, wins
      from public.hayna_game_captains
      order by trophies desc, wins desc, created_at asc limit 20
    ) t;

  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
    into v_targets from (
      select id, alias, level, trophies, fortress
      from public.hayna_game_captains
      where id <> v_me.id and shield_until <= now()
      order by random() limit 6
    ) t;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', b.id,
    'opponent', case when b.versus_pirates then 'قراصنة الضباب'
      when b.attacker_id = v_me.id then d.alias else a.alias end,
    'victory', case when b.attacker_id = v_me.id then b.attacker_won else not b.attacker_won end,
    'attacked', b.attacker_id = v_me.id,
    'gold', b.gold_loot,
    'when', b.created_at
  ) order by b.created_at desc), '[]'::jsonb)
  into v_history
  from (select * from public.hayna_game_battles
        where attacker_id = v_me.id or defender_id = v_me.id
        order by created_at desc limit 12) b
  left join public.hayna_game_captains a on a.id = b.attacker_id
  left join public.hayna_game_captains d on d.id = b.defender_id;

  return jsonb_build_object(
    'joined', true,
    'me', to_jsonb(v_me) - 'user_id',
    'rank', v_rank,
    'leaders', v_leaders,
    'targets', v_targets,
    'history', v_history,
    'server_now', now()
  );
end;
$$;

create or replace function public.hayna_game_join()
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'سجّل الدخول أولًا'; end if;
  insert into public.hayna_game_captains (user_id) values (auth.uid())
  on conflict (user_id) do nothing;
  return public.hayna_game_state();
end;
$$;

create or replace function public.hayna_game_command(p_action text, p_target_id uuid default null)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_me public.hayna_game_captains%rowtype;
  v_target public.hayna_game_captains%rowtype;
  v_minutes integer;
  v_cost integer;
  v_deployed integer;
  v_lost integer;
  v_attack integer;
  v_defense integer;
  v_won boolean;
  v_gold integer := 0;
  v_timber integer := 0;
  v_message text;
begin
  if v_user is null then raise exception 'سجّل الدخول أولًا'; end if;
  if p_action not in ('collect','recruit','fortify','upgrade','pirates','attack') then
    raise exception 'أمر غير معروف';
  end if;
  select id into v_id from public.hayna_game_captains where user_id = v_user;
  if v_id is null then raise exception 'أنشئ جزيرتك أولًا'; end if;

  if p_action = 'attack' then
    if p_target_id is null or p_target_id = v_id then raise exception 'اختر خصمًا صالحًا'; end if;
    -- Stable lock order prevents mutual attacks from deadlocking.
    perform 1 from public.hayna_game_captains
    where id in (v_id, p_target_id) order by id for update;
    select * into v_target from public.hayna_game_captains where id = p_target_id;
    if not found then raise exception 'الخصم غير متاح'; end if;
  else
    perform 1 from public.hayna_game_captains where id = v_id for update;
  end if;
  select * into v_me from public.hayna_game_captains where id = v_id;

  if p_action = 'collect' then
    v_minutes := least(360, greatest(0, floor(extract(epoch from now() - v_me.last_collected_at) / 60)::integer));
    if v_minutes < 1 then raise exception 'موعد الحصاد القادم بعد قليل'; end if;
    update public.hayna_game_captains
      set gold = least(100000, gold + v_minutes * 12),
          timber = least(100000, timber + v_minutes * 10),
          food = least(100000, food + v_minutes * 10),
          last_collected_at = now()
    where id = v_id;
    return jsonb_build_object('message', 'تم جمع موارد الجزيرة', 'earned', v_minutes);
  elsif p_action = 'recruit' then
    if v_me.gold < 55 or v_me.food < 70 then raise exception 'تحتاج ٥٥ ذهب و٧٠ مؤونة لتدريب الجنود'; end if;
    if v_me.troops > 492 then raise exception 'اكتملت سعة الجيش'; end if;
    update public.hayna_game_captains set gold = gold - 55, food = food - 70,
      troops = troops + 8 where id = v_id;
    return jsonb_build_object('message', 'انضم ٨ جنود جدد إلى جيشك');
  elsif p_action = 'fortify' then
    if v_me.gold < 55 or v_me.timber < 90 then raise exception 'تحتاج ٥٥ ذهب و٩٠ خشب للتحصين'; end if;
    if v_me.fortress > 386 then raise exception 'اكتمل تحصين القلعة'; end if;
    update public.hayna_game_captains set gold = gold - 55, timber = timber - 90,
      fortress = fortress + 14 where id = v_id;
    return jsonb_build_object('message', 'زادت قوة تحصين قلعتك');
  elsif p_action = 'upgrade' then
    if v_me.level >= 25 then raise exception 'وصلت لأعلى مستوى للقلعة'; end if;
    v_cost := v_me.level * 140;
    if v_me.gold < v_cost or v_me.timber < v_me.level * 105 then
      raise exception 'تحتاج % ذهب و% خشب لترقية القلعة', v_cost, v_me.level * 105;
    end if;
    update public.hayna_game_captains set gold = gold - v_cost,
      timber = timber - v_me.level * 105, level = level + 1,
      fortress = least(400, fortress + 8)
      where id = v_id;
    return jsonb_build_object('message', 'ارتقت قلعتك إلى المستوى ' || (v_me.level + 1));
  end if;

  -- Both PvP and pirate battles consume troops and respect a server-side cooldown.
  if v_me.last_attack_at is not null and v_me.last_attack_at > now() - interval '2 minutes' then
    raise exception 'الأسطول يحتاج دقيقتين للاستعداد قبل الهجوم التالي';
  end if;
  if v_me.troops < 8 then raise exception 'درّب ٨ جنود على الأقل للمعركة'; end if;
  if p_action = 'attack' and v_target.shield_until > now() then
    raise exception 'هذا الخصم تحت الحماية حاليًا';
  end if;

  v_deployed := least(25, v_me.troops);
  v_attack := v_deployed * (7 + v_me.level) + floor(random() * 76)::integer;
  if p_action = 'pirates' then
    v_defense := 85 + v_me.level * 20 + floor(random() * 105)::integer;
  else
    v_defense := v_target.fortress * 5 + least(v_target.troops, 40) * 3
      + v_target.level * 15 + floor(random() * 76)::integer;
  end if;
  v_won := v_attack >= v_defense;
  v_lost := greatest(2, ceil(v_deployed * (case when v_won then 0.34 else 0.65 end))::integer);
  if v_won then
    if p_action = 'pirates' then
      v_gold := 45 + v_me.level * 8;
      v_timber := 30 + v_me.level * 5;
    else
      v_gold := least(v_target.gold, 45 + v_me.level * 8);
      v_timber := least(v_target.timber, 30 + v_me.level * 5);
    end if;
  end if;

  update public.hayna_game_captains set
    troops = greatest(0, troops - v_lost),
    gold = least(100000, gold + v_gold),
    timber = least(100000, timber + v_timber),
    trophies = greatest(0, trophies + (case when v_won then 17 else -8 end)),
    wins = wins + (case when v_won then 1 else 0 end),
    losses = losses + (case when v_won then 0 else 1 end),
    last_attack_at = now()
  where id = v_id;

  if p_action = 'attack' then
    update public.hayna_game_captains set
      gold = greatest(0, gold - v_gold),
      timber = greatest(0, timber - v_timber),
      trophies = greatest(0, trophies - (case when v_won then 10 else 0 end)),
      shield_until = now() + interval '12 minutes',
      losses = losses + (case when v_won then 1 else 0 end),
      wins = wins + (case when v_won then 0 else 1 end)
    where id = v_target.id;
  end if;
  insert into public.hayna_game_battles
    (attacker_id, defender_id, versus_pirates, attacker_won, gold_loot, timber_loot, lost_troops)
    values (v_id, case when p_action = 'attack' then v_target.id else null end,
      p_action = 'pirates', v_won, v_gold, v_timber, v_lost);

  return jsonb_build_object(
    'message', case when v_won then 'انتصار! غنمت موارد ورفعت ترتيبك' else 'المعركة انتهت بخسارة، طوّر جيشك وارجع أقوى' end,
    'battle', jsonb_build_object('won', v_won, 'attack', v_attack,
      'defense', v_defense, 'lost_troops', v_lost, 'gold', v_gold, 'timber', v_timber)
  );
end;
$$;

-- No direct client writes. SQL functions check auth.uid(), targets and costs.
revoke all on function public.hayna_game_state() from public, anon;
revoke all on function public.hayna_game_join() from public, anon;
revoke all on function public.hayna_game_command(text, uuid) from public, anon;
grant execute on function public.hayna_game_state() to authenticated;
grant execute on function public.hayna_game_join() to authenticated;
grant execute on function public.hayna_game_command(text, uuid) to authenticated;

-- Multi-guest live rooms: configurable seat limits and stable participant ordering.
alter table public.live_streams add column if not exists guest_limit smallint not null default 4;
alter table public.live_streams drop constraint if exists live_streams_guest_limit_check;
alter table public.live_streams add constraint live_streams_guest_limit_check check (guest_limit between 1 and 8);
alter table public.live_guest_requests add column if not exists seat_order integer not null default 0;

with ranked as (
  select id, row_number() over (partition by stream_id order by decided_at nulls last, created_at, id)::integer as position
  from public.live_guest_requests where status = 'accepted'
)
update public.live_guest_requests g set seat_order = ranked.position
from ranked where g.id = ranked.id and g.seat_order = 0;

create index if not exists live_guest_requests_accepted_order_idx
  on public.live_guest_requests (stream_id, seat_order) where status = 'accepted';

create or replace function public.live_enforce_guest_seat_limit()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_guest_limit integer; v_accepted integer; v_next_order integer;
begin
  if new.status = 'accepted' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    select s.guest_limit into v_guest_limit from public.live_streams s
    where s.id = new.stream_id and s.status = 'live' for update;
    if not found then raise exception 'انتهى البث ولا يمكن قبول ضيف جديد.'; end if;
    select count(*)::integer, coalesce(max(g.seat_order), 0) + 1 into v_accepted, v_next_order
    from public.live_guest_requests g
    where g.stream_id = new.stream_id and g.status = 'accepted' and g.id <> new.id;
    if v_accepted >= v_guest_limit then raise exception 'اكتملت مقاعد الضيوف في هذا البث.'; end if;
    new.seat_order := v_next_order;
    new.decided_at := coalesce(new.decided_at, pg_catalog.now());
  end if;
  return new;
end;
$$;
revoke all on function public.live_enforce_guest_seat_limit() from public, anon, authenticated;
drop trigger if exists live_guest_seat_limit_guard on public.live_guest_requests;
create trigger live_guest_seat_limit_guard before insert or update of status on public.live_guest_requests
for each row execute function public.live_enforce_guest_seat_limit();

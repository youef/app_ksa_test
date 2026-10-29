const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createDatabase, asUser, root } = require('./databaseHarness.cjs');
const fs = require('node:fs');
const original = fs.readFileSync(path.join(root,'supabase/migrations/202610130005_analytics_events.sql'),'utf8');
const ids = Array.from({length:6},(_,i)=>`00000000-0000-4000-8000-00000000000${i+1}`);
const schema = `
 create table public.profiles(id uuid primary key,created_at timestamptz default now(),city text,district text,is_banned boolean default false,role text default 'member');
 create table public.questions(id uuid primary key default gen_random_uuid(),author_id uuid references profiles(id),created_at timestamptz default now());
 create table public.requests(id uuid primary key default gen_random_uuid(),requester_id uuid references profiles(id),created_at timestamptz default now(),city text,district text);
 create table public.services(id uuid primary key default gen_random_uuid(),provider_id uuid references profiles(id),created_at timestamptz default now(),price_from numeric,city text,district text);
 create table public.stories(id uuid primary key default gen_random_uuid(),author_id uuid references profiles(id));
 create table public.marketplace_items(id uuid primary key default gen_random_uuid(),seller_id uuid references profiles(id));
 create table public.answers(id uuid primary key default gen_random_uuid(),author_id uuid references profiles(id),question_id uuid references questions(id));
 create table public.question_likes(question_id uuid,user_id uuid,primary key(question_id,user_id));
 create table public.story_likes(story_id uuid,user_id uuid,primary key(story_id,user_id));
 create function public.hayna_has_permission(p text) returns boolean language sql stable security definer set search_path=pg_catalog as $$select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and not is_banned)$$;
 insert into public.profiles(id,city,district,role,created_at) values ${ids.map((id,i)=>`('${id}','الرياض','النرجس','${i===5?'admin':'member'}',now()-interval '20 days')`).join(',')};
 ${original}
 grant all on all tables in schema public to anon,authenticated;
 grant usage on all sequences in schema public to anon,authenticated;
`;
let db;
test.before(async()=>{db=await createDatabase({schema,migration:path.join(root,'artifacts/integration-analytics.sql')});});
test.after(async()=>{if(db)await db.close();});
async function rootRole(){await db.exec('reset role');}
async function scalar(q,args=[]){return Object.values((await db.query(q,args)).rows[0])[0];}

test('telemetry authenticates, rejects private properties and deduplicates reloads on the server',async()=>{
 await asUser(db,null,'anon');
 await assert.rejects(()=>db.query("select public.hayna_record_analytics('app_open','open','{}',null)"),/permission denied/);
 await asUser(db,ids[0]);
 assert.equal(await scalar("select public.hayna_record_analytics('app_open','open','{}',null)"),true);
 assert.equal(await scalar("select public.hayna_record_analytics('app_open','reload','{}',null)"),false);
 await assert.rejects(()=>db.query("select public.hayna_record_analytics('home_view','home','{\"password\":\"secret\"}',null)"),/Unsupported analytics properties/);
 await assert.rejects(()=>db.query("select public.hayna_record_analytics('content_created','fake','{}',null)"),/Unsupported analytics event/);
 await assert.rejects(()=>db.query("insert into public.analytics_events(user_id,event_name) values($1,'forged')",[ids[1]]),/permission denied/);
 await assert.rejects(()=>db.query('truncate public.analytics_events'),/permission denied/);
 await assert.rejects(()=>db.query('select * from public.analytics_events'),/permission denied/);
 await rootRole();
 const row=(await db.query("select user_id,city,district,ip,user_agent,properties from public.analytics_events where event_name='app_open'")).rows[0];
 assert.deepEqual(row,{user_id:ids[0],city:'الرياض',district:'النرجس',ip:null,user_agent:null,properties:{}});
});

test('successful server writes track content and first contribution once, and interaction retries do not duplicate',async()=>{
 await rootRole();
 const q='11111111-1111-4111-8111-111111111111';
 await db.query('insert into questions(id,author_id) values($1,$2)',[q,ids[0]]);
 await db.query('insert into requests(requester_id) values($1)',[ids[0]]);
 await db.query('insert into question_likes(question_id,user_id) values($1,$2)',[q,ids[1]]);
 await db.query('delete from question_likes where question_id=$1',[q]);
 await db.query('insert into question_likes(question_id,user_id) values($1,$2)',[q,ids[1]]);
 assert.equal(await scalar("select count(*)::int from analytics_events where user_id=$1 and event_name='first_content_created'",[ids[0]]),1);
 assert.equal(await scalar("select count(*)::int from analytics_events where event_name='content_created'"),2);
 assert.equal(await scalar("select count(*)::int from analytics_events where event_name='content_interacted'"),1);
});

test('DAU counts one actor and uses Riyadh midnight rather than UTC',async()=>{
 await rootRole();
 await db.query("insert into analytics_events(user_id,event_name,created_at,dedupe_key) values($1,'app_open','2026-01-01T21:01:00Z','boundary1'),($1,'home_view','2026-01-01T23:01:00Z','boundary2')",[ids[2]]);
 await db.query("select public.compute_dau('2026-01-02')");
 assert.equal(await scalar("select dau from analytics_dau where date='2026-01-02'"),1);
 await db.query("select public.compute_dau('2026-01-01')");
 assert.equal(await scalar("select dau from analytics_dau where date='2026-01-01'"),0);
});

test('funnel counts ordered unique actors, omits out-of-order steps and treats return separately',async()=>{
 await rootRole();
 const stages=['app_open','authenticated','location_set','home_view','section_open','first_content_created','content_interacted'];
 for(let i=0;i<stages.length;i++)await db.query("insert into analytics_events(user_id,event_name,created_at,dedupe_key) values($1,$2,('2026-02-02T10:00:00Z'::timestamptz + $3*interval '1 minute'),$4)",[ids[3],stages[i],i,`funnel-${i}`]);
 await db.query("insert into analytics_events(user_id,event_name,created_at,dedupe_key) values($1,'home_view','2026-02-02T09:00:00Z','out-order'),($1,'app_open','2026-02-02T11:00:00Z','late-open')",[ids[4]]);
 const funnel=await scalar("select app_private.analytics_funnel('2026-02-02','2026-02-03')");
 assert.equal(funnel[0].count,2); assert.equal(funnel[1].count,1); assert.equal(funnel[6].count,1); assert.equal(funnel[7].count,0);
});

test('retention uses account cohort, excludes future weeks and avoids reclassifying old accounts as new',async()=>{
 await rootRole();
 await db.query("update profiles set created_at='2026-01-05T10:00:00Z' where id=$1",[ids[2]]);
 await db.query("insert into analytics_events(user_id,event_name,created_at,dedupe_key) values($1,'app_open','2026-01-13T10:00:00Z','retention-return')",[ids[2]]);
 await db.query("select compute_retention_weekly('2026-01-05')");
 assert.equal(await scalar("select cohort_size from analytics_retention_weekly where cohort_week='2026-01-05' and week_number=1"),1);
 assert.equal(await scalar("select retained_count from analytics_retention_weekly where cohort_week='2026-01-05' and week_number=1"),1);
 await db.query("select compute_retention_weekly((now() at time zone 'Asia/Riyadh')::date)");
 assert.equal(await scalar("select count(*)::int from analytics_retention_weekly where cohort_week+week_number*7>(now() at time zone 'Asia/Riyadh')::date"),0);
});

test('heatmap hides fewer than five distinct actors despite many repeated events',async()=>{
 await rootRole();
 for(let i=0;i<4;i++)await db.query("insert into analytics_events(user_id,event_name,created_at,dedupe_key,city,district) values($1,'app_open','2026-03-02T10:00:00Z',$2,'جدة','الروضة')",[ids[i],`heat-${i}`]);
 for(let i=0;i<7;i++)await db.query("insert into analytics_events(user_id,event_name,created_at,dedupe_key,city,district) values($1,'section_open','2026-03-02T11:00:00Z',$2,'جدة','الروضة')",[ids[0],`heat-repeat-${i}`]);
 await db.query("select compute_heatmap_daily('2026-03-02')");
 assert.equal(await scalar("select count(*)::int from analytics_heatmap_daily where date='2026-03-02'"),0);
 await db.query("insert into analytics_events(user_id,event_name,created_at,dedupe_key,city,district) values($1,'app_open','2026-03-02T10:00:00Z','heat-fifth','جدة','الروضة')",[ids[4]]);
 await db.query("select compute_heatmap_daily('2026-03-02')");
 assert.equal(await scalar("select active_users from analytics_heatmap_daily where date='2026-03-02'"),5);
});

test('missing payment tables are unavailable and advertised service prices never become income',async()=>{
 await rootRole();
 await db.query("insert into services(provider_id,price_from) values($1,9999)",[ids[0]]);
 await db.query("select compute_revenue_daily((now() at time zone 'Asia/Riyadh')::date)");
 const r=(await db.query('select * from analytics_revenue_daily order by date desc limit 1')).rows[0];
 assert.equal(r.source_available,false); assert.equal(Number(r.confirmed_revenue),0); assert.equal(Number(r.total_estimated),0); assert.equal(r.net_revenue,null);
});

test('only confirmed matched payments count once, refunds reduce collected total and unknown fees remain unknown',async()=>{
 await rootRole();
 await db.exec(`create table marketplace_orders(id uuid primary key,order_type text,amount_halalas bigint,status text,paid_at timestamptz,currency text); create table marketplace_payment_transactions(id uuid default gen_random_uuid(),order_id uuid,status text,paid_at timestamptz,currency text,amount_halalas bigint);`);
 const order='22222222-2222-4222-8222-222222222222';
 await db.query("insert into marketplace_orders values($1,'ad_campaign',4900,'paid','2026-04-02T11:00:00Z','SAR')",[order]);
 await db.query("insert into marketplace_payment_transactions(order_id,status,paid_at,currency,amount_halalas) values($1,'paid','2026-04-02T11:00:00Z','SAR',4900),($1,'paid','2026-04-02T11:00:00Z','SAR',4900)",[order]);
 await db.exec("insert into marketplace_orders values('33333333-3333-4333-8333-333333333333','service_order',9900,'pending',null,'SAR'); select compute_revenue_daily('2026-04-02');");
 let r=(await db.query("select * from analytics_revenue_daily where date='2026-04-02'")).rows[0];
 assert.equal(Number(r.confirmed_revenue),49); assert.equal(r.transaction_count,1); assert.equal(r.fees_amount,null); assert.equal(r.net_revenue,null);
 await db.query("update marketplace_orders set status='refunded' where id=$1",[order]);
 await db.exec("select compute_revenue_daily('2026-04-02')");
 assert.equal(Number(await scalar("select refunded_amount from analytics_revenue_daily where date='2026-04-02'")),49);
});

test('dashboard enforces permission, returns aggregate-only data for 7/30/90 days, and direct computations are server-only',async()=>{
 await asUser(db,ids[0]);
 await assert.rejects(()=>db.query('select public.hayna_analytics_dashboard(7)'),/Analytics permission required/);
 await assert.rejects(()=>db.query('select public.compute_dau(current_date)'),/permission denied/);
 assert.equal((await db.query('select * from analytics_dau')).rows.length,0);
 await asUser(db,ids[5]);
 for(const days of [7,30,90]){
  const d=await scalar('select public.hayna_analytics_dashboard($1)',[days]);
  assert.equal(d.days,days); assert.equal(d.dau.length,days); assert.equal(d.timezone,'Asia/Riyadh');
  assert.equal(JSON.stringify(d).includes('user_id'),false); assert.equal(JSON.stringify(d).includes('latitude'),false);
 }
 await assert.rejects(()=>db.query('select public.hayna_analytics_dashboard(365)'),/Invalid reporting range/);
});

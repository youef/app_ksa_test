const test = require('node:test');
const assert = require('node:assert/strict');
const { createDatabase, asUser } = require('./databaseHarness.cjs');
const id = n => '00000000-0000-0000-0000-' + String(n).padStart(12, '0');
const owner=id(1), reviewer=id(2), outsider=id(3), legacyAdmin=id(4), manager=id(5), business=id(11), service=id(12), conversation=id(13);
const fixtures = `
insert into profiles(id,account_type,is_verified,is_verified_merchant,city,district)values('${owner}','merchant',true,true,'الرياض','النرجس'),('${reviewer}','standard',false,false,'الرياض','النرجس'),('${outsider}','standard',false,false,'الرياض','النرجس'),('${legacyAdmin}','standard',false,false,'الرياض','النرجس'),('${manager}','standard',false,false,'الرياض','النرجس');
update profiles set role='admin'where id='${legacyAdmin}';
insert into commerce_test_permissions values('${manager}','events'),('${manager}','market'),('${manager}','reports');
insert into businesses(id,owner_id,name,city,district)values('${business}','${owner}','منشأة الاختبار','الرياض','النرجس');
insert into services(id,provider_id,name,city,district)values('${service}','${owner}','خدمة الاختبار','الرياض','النرجس');
insert into banned_words values('forbidden',true);
alter table businesses enable row level security;
alter table services enable row level security;
create policy test_business_read on businesses for select to anon,authenticated using(moderation_status='approved'or owner_id=auth.uid());
create policy test_service_read on services for select to anon,authenticated using(moderation_status='approved'or provider_id=auth.uid());
`;
test('commerce systems execute with PostgreSQL constraints, RPCs and real RLS roles', async t => {
  const db=await createDatabase({schema:'tests/fixtures/commerce-schema.sql',migration:'artifacts/integration-commerce.sql',fixtures});
  t.after(()=>db.close());
  const rows=async(sql,params=[]) => (await db.query(sql,params)).rows;
  const value=async(sql,params=[]) => Object.values((await rows(sql,params))[0])[0];
  const reject=async(sql,params=[],pattern) => assert.rejects(db.query(sql,params), pattern);
  await t.test('excess grants are removed; anonymous cannot change hours or RSVP',async()=>{
    await asUser(db,null,'anon');
    assert.equal(await value("select has_table_privilege('anon','business_hours','TRUNCATE')"),false);
    assert.equal(await value("select has_table_privilege('authenticated','reviews','TRUNCATE')"),false);
    await reject("insert into event_attendees(event_id,user_id)values($1,$2)",[id(99),reviewer]);
    await reject('select hayna_save_business_hours($1,$2::jsonb,null)',[business,'[]']);
  });
  await t.test('owner saves multiple periods, overnight and closure; rejected replacement rolls back',async()=>{
    await asUser(db,owner);
    const periods=[{day_of_week:6,period_index:0,opens_at:'22:00',closes_at:'02:00',is_closed:false},{day_of_week:1,period_index:0,opens_at:'09:00',closes_at:'12:00',is_closed:false},{day_of_week:1,period_index:1,opens_at:'17:00',closes_at:'21:00',is_closed:false}];
    await db.query('select hayna_save_business_hours($1,$2::jsonb,null)',[business,JSON.stringify(periods)]);
    assert.equal((await value("select hayna_business_status($1,'2026-10-31T22:00:00Z')",[business])).is_open,true,'Sunday 01:00 belongs to Saturday overnight shift');
    assert.equal((await value("select hayna_business_status($1,'2026-10-31T23:00:00Z')",[business])).is_open,false,'closing endpoint is exclusive');
    const overlapping=[...periods,{day_of_week:0,period_index:0,opens_at:'01:00',closes_at:'03:00',is_closed:false}];
    await reject('select hayna_save_business_hours($1,$2::jsonb,null)',[business,JSON.stringify(overlapping)],/business_hours_overlap/);
    assert.equal(Number(await value('select count(*)from business_hours where business_id=$1',[business])),3,'previous complete week survives failure');
    await asUser(db,outsider); await reject('select hayna_save_business_hours($1,$2::jsonb,null)',[business,'[]'],/business_owner_required/);
    await asUser(db,legacyAdmin); await reject('select hayna_save_business_hours($1,$2::jsonb,null)',[business,'[]'],/business_owner_required/);
  });
  await t.test('public read of hours follows business visibility; temporary closure has next opening',async()=>{
    await asUser(db,owner);
    const periods=[{day_of_week:1,period_index:0,opens_at:'09:00',closes_at:'18:00',is_closed:false}];
    await db.query("select hayna_save_business_hours($1,$2::jsonb,now()+interval'7 days')",[business,JSON.stringify(periods)]);
    const status=await value('select hayna_business_status($1)',[business]);
    assert.equal(status.is_open,false);assert.ok(status.next_opens_at);
    await asUser(db,null,'anon');assert.equal(Number(await value('select count(*)from business_hours')),1);
    await db.exec('reset role');await db.query("update businesses set moderation_status='pending'where id=$1",[business]);
    await asUser(db,null,'anon');assert.equal(Number(await value('select count(*)from business_hours')),0);
    await db.exec('reset role');await db.query("update businesses set moderation_status='approved'where id=$1",[business]);
  });
  let review;
  await t.test('reviews require mutual interaction, reject self and spoofing, support service targets',async()=>{
    await asUser(db,reviewer);await reject('insert into reviews(reviewer_id,business_id,rating)values($1,$2,5)',[reviewer,business],/mutual_contact_required/);
    await asUser(db,owner);await reject('insert into reviews(reviewer_id,business_id,rating)values($1,$2,5)',[owner,business],/cannot_review_self/);
    await db.exec('reset role');
    await db.query('insert into conversations(id,created_by)values($1,$2)',[conversation,reviewer]);
    await db.query('insert into conversation_members(conversation_id,user_id)values($1,$2),($1,$3)',[conversation,reviewer,owner]);
    await db.query("insert into messages(conversation_id,sender_id,body)values($1,$2,'طلب معلومات'),($1,$3,'تفاصيل الخدمة')",[conversation,reviewer,owner]);
    await asUser(db,reviewer);review=(await rows('insert into reviews(reviewer_id,business_id,rating,body)values($1,$2,4,$3)returning id',[reviewer,business,'تواصل واضح']))[0].id;
    await reject('insert into reviews(reviewer_id,business_id,rating)values($1,$2,5)',[reviewer,business],/duplicate key/);
    await reject('insert into reviews(reviewer_id,service_id,rating)values($1,$2,5)',[outsider,service],/review_owner_required/);
    await reject('insert into reviews(reviewer_id,service_id,rating)values($1,$2,6)',[reviewer,service]);
    await reject('insert into reviews(reviewer_id,service_id,rating,body)values($1,$2,5,$3)',[reviewer,service,'forbidden'],/content_not_allowed/);
    await db.query('insert into reviews(reviewer_id,service_id,rating)values($1,$2,5)',[reviewer,service]);
    assert.deepEqual(await value("select hayna_review_summary('business',$1)",[business]),{count:1,average:4});
  });
  await t.test('review editing/deletion is owner scoped, identity immutable and notifications are idempotent',async()=>{
    await asUser(db,outsider);
    assert.equal((await rows('update reviews set rating=1 where id=$1 returning id',[review])).length,0);
    assert.equal((await rows('delete from reviews where id=$1 returning id',[review])).length,0);
    await asUser(db,reviewer);await reject('update reviews set business_id=null,service_id=$1 where id=$2',[service,review],/review_identity_immutable/);
    await db.query('update reviews set rating=3 where id=$1',[review]);
    assert.equal((await value("select hayna_review_summary('business',$1)",[business])).average,3);
    await db.exec('reset role');assert.equal(Number(await value("select count(*)from notifications where target_id=$1",[review])),1);
    await asUser(db,owner);await db.query("select hayna_set_notification_preferences('{\"reviews\":false}')");
    await asUser(db,reviewer);await db.query('delete from reviews where service_id=$1',[service]);await db.query('insert into reviews(reviewer_id,service_id,rating)values($1,$2,4)',[reviewer,service]);
    await db.exec('reset role');assert.equal(Number(await value("select count(*)from notifications where type='review'")),2,'second service review sends no notification after opt-out');
  });
  let event;
  await t.test('events validate dates, bind profile location and require explicit delegated permissions',async()=>{
    await asUser(db,owner);
    event=(await rows("insert into events(organizer_id,title,city,district,starts_at,ends_at,location_name,capacity,latitude,longitude)values($1,'لقاء الحي','مدينة مزورة','حي مزور',now()+interval'2 hours',now()+interval'4 hours','الحديقة العامة',1,24.123456,46.123456)returning *",[owner]))[0];
    assert.equal(event.city,'الرياض');assert.equal(event.district,'النرجس');assert.equal(event.latitude,null);assert.equal(event.moderation_status,'pending');
    await db.query("update events set moderation_status='approved',attendees_count=99 where id=$1",[event.id]);
    assert.equal((await rows('select moderation_status,attendees_count from events where id=$1',[event.id]))[0].moderation_status,'pending');
    await asUser(db,legacyAdmin);assert.equal((await rows("update events set moderation_status='approved'where id=$1 returning id",[event.id])).length,0);
    await asUser(db,manager);await db.query("update events set moderation_status='approved'where id=$1",[event.id]);
    await reject('update events set ends_at=starts_at where id=$1',[event.id],/invalid_event_details/);
    await asUser(db,outsider);await reject("insert into events(organizer_id,title,city,starts_at,ends_at,location_name)values($1,'لقاء غير مخول','الرياض',now()+interval'1 day',now()+interval'2 days','الحديقة')",[outsider],/verified_event_organizer_required/);
  });
  await t.test('RSVP enforces capacity, idempotency, no direct writes and participant privacy',async()=>{
    await asUser(db,reviewer);
    await db.query('select hayna_event_attendance($1,true,true)',[event.id]);await db.query('select hayna_event_attendance($1,true,true)',[event.id]);
    assert.equal(Number(await value('select count(*)from event_attendees')),1);
    await reject("update event_attendees set status='cancelled'where event_id=$1",[event.id]);
    await asUser(db,outsider);assert.equal(Number(await value('select count(*)from event_attendees')),0);
    await reject('select hayna_event_attendance($1,true,true)',[event.id],/event_full/);
    await asUser(db,owner);assert.equal(Number(await value('select count(*)from event_attendees')),1);
    assert.equal((await rows('select moderation_status from events where id=$1',[event.id]))[0].moderation_status,'approved','RSVP never triggers event moderation');
    await asUser(db,manager);await db.query('update events set show_attendee_count=false where id=$1',[event.id]);
    await asUser(db,outsider);assert.equal((await rows('select *from hayna_event_counts(array[$1::uuid])',[event.id]))[0].attendee_count,null);
    await asUser(db,reviewer);await db.query('select hayna_event_attendance($1,false,true)',[event.id]);
    await asUser(db,outsider);await db.query('select hayna_event_attendance($1,true,true)',[event.id]);
    await asUser(db,owner);assert.equal((await rows('select *from hayna_event_counts(array[$1::uuid])',[event.id]))[0].attendee_count,1);
  });
  await t.test('reminders run server-side once, respect opt-out and refuse ordinary users',async()=>{
    await asUser(db,outsider);await db.query("select hayna_set_notification_preferences('{\"events\":false}')");await reject('select hayna_dispatch_event_reminders()',[],/permission_required/);
    await asUser(db,manager);assert.equal(await value('select hayna_dispatch_event_reminders()'),0);
    await asUser(db,outsider);await db.query("select hayna_set_notification_preferences('{\"events\":true}')");
    await asUser(db,manager);assert.equal(await value('select hayna_dispatch_event_reminders()'),1);assert.equal(await value('select hayna_dispatch_event_reminders()'),0);
    await db.exec('reset role');assert.equal(Number(await value("select count(*)from notifications where type='event_reminder'")),1);
  });
  await t.test('report is deduplicated; cancelled or expired events reject registration',async()=>{
    await asUser(db,reviewer);const first=await value("select hayna_report_commerce('event',$1,'معلومات غير صحيحة')",[event.id]);const again=await value("select hayna_report_commerce('event',$1,'معلومات غير صحيحة')",[event.id]);assert.equal(first,again);
    await asUser(db,manager);await db.query("update events set status='cancelled'where id=$1",[event.id]);
    await asUser(db,reviewer);await reject('select hayna_event_attendance($1,true,true)',[event.id],/event_unavailable/);
    await asUser(db,manager);await db.query("update events set status='published',starts_at=now()-interval'4 hours',ends_at=now()-interval'2 hours'where id=$1",[event.id]);
    await asUser(db,reviewer);await reject('select hayna_event_attendance($1,true,true)',[event.id],/event_unavailable/);
  });
  await t.test('notification preferences reject nonbooleans and unknown authorization fields',async()=>{
    await asUser(db,reviewer);await reject("select hayna_set_notification_preferences('{\"events\":\"false\"}')",[],/invalid_preferences/);await reject("select hayna_set_notification_preferences('{\"role\":true}')",[],/invalid_preferences/);
  });
  await t.test('hidden review cannot be republished by its author; moderation creates audit entries',async()=>{
    await asUser(db,manager);await db.query("update reviews set moderation_status='hidden'where id=$1",[review]);
    await asUser(db,reviewer);await db.query('update reviews set rating=5 where id=$1',[review]);
    assert.equal((await rows('select moderation_status from reviews where id=$1',[review]))[0].moderation_status,'hidden');
    assert.equal((await value("select hayna_review_summary('business',$1)",[business])).count,0);
    await db.exec('reset role');assert.ok(Number(await value("select count(*)from admin_activity_logs where target_id=$1",[review]))>=1);
  });
  await t.test('direct malformed notification JSON cannot poison server-side dispatch casts',async()=>{
    await db.exec('reset role');await reject("update profiles set notification_preferences='{\"events\":\"wrong\"}'where id=$1",[reviewer],/invalid_preferences/);
  });
});

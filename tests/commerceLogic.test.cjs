const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
function load(file,mocks={}){const code=ts.transpileModule(fs.readFileSync(require.resolve(file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;const module={exports:{}};vm.runInNewContext(code,{module,exports:module.exports,require:name=>{if(!(name in mocks))throw Error(name);return mocks[name];},Date,Intl,Map,Set,console});return module.exports;}
const hours=load('../lib/businessHours.ts',{'./supabase':{supabase:{}}});
test('Saudi date input is device timezone independent and rejects normalized invalid dates',()=>{
 assert.equal(hours.saudiDateTimeToISO('2026-12-30T17:45'),'2026-12-30T14:45:00.000Z');
 assert.equal(hours.saudiDateTimeToISO('2026-02-30T17:45'),null);
 assert.equal(hours.saudiDateTimeToISO('2026-12-30T25:00'),null);
 assert.equal(hours.saudiDateTimeToISO('2026-12-30'),null);
});
test('weekly validation includes overnight overlap over Saturday/Sunday boundary',()=>{
 const shift=(day,slot,opens,closes)=>({day_of_week:day,period_index:slot,opens_at:opens,closes_at:closes,is_closed:false});
 assert.equal(hours.validatePeriods([shift(6,0,'22:00','02:00'),shift(0,0,'02:00','03:00')]),null);
 assert.ok(hours.validatePeriods([shift(6,0,'22:00','02:00'),shift(0,0,'01:59','03:00')]));
 assert.ok(hours.validatePeriods([shift(1,0,'09:00','09:00')]));
 assert.ok(hours.validatePeriods([shift(1,0,'09:00','17:00'),{day_of_week:1,period_index:1,is_closed:true,opens_at:null,closes_at:null}]));
});
test('separate daily periods are valid while duplicate slots and malformed times fail',()=>{
 const first={day_of_week:2,period_index:0,opens_at:'09:00',closes_at:'12:00',is_closed:false};
 assert.equal(hours.validatePeriods([first,{...first,period_index:1,opens_at:'17:00',closes_at:'22:00'}]),null);
 assert.ok(hours.validatePeriods([first,{...first}]));
 assert.ok(hours.validatePeriods([{...first,opens_at:'9am'}]));
});
test('event phases use real timestamps, exclusive ending and explicit cancellation',()=>{
 const events=load('../lib/events.ts',{'./supabase':{supabase:{}},'./businessHours':hours});
 const e={status:'published',starts_at:'2026-12-30T14:00Z',ends_at:'2026-12-30T16:00Z'};
 assert.equal(events.eventPhase(e,Date.parse('2026-12-30T13:59Z')),'upcoming');
 assert.equal(events.eventPhase(e,Date.parse(e.starts_at)),'ongoing');
 assert.equal(events.eventPhase(e,Date.parse(e.ends_at)),'ended');
 assert.equal(events.eventPhase({...e,status:'cancelled'},Date.parse(e.starts_at)),'cancelled');
});
test('event draft requires future real dates and optional bounded capacity',()=>{
 const events=load('../lib/events.ts',{'./supabase':{supabase:{}},'./businessHours':hours});
 const draft={title:'لقاء الجيران',description:'رياضة في الحديقة',location:'الحديقة العامة',starts:'2026-12-30T17:00',ends:'2026-12-30T18:00',capacity:'20',isFree:true,showCount:true};
 assert.equal(events.validateEventDraft(draft,Date.parse('2026-12-01')).capacity,20);
 assert.throws(()=>events.validateEventDraft({...draft,capacity:'1.5'},Date.parse('2026-12-01')));
 assert.throws(()=>events.validateEventDraft({...draft,ends:draft.starts},Date.parse('2026-12-01')));
 assert.throws(()=>events.validateEventDraft(draft,Date.parse('2027-01-01')));
});
test('unknown event location never fetches every city; scope is applied before pagination',async()=>{
 const calls=[];const q={};for(const name of ['select','eq','gt','order','range'])q[name]=(...args)=>{calls.push([name,...args]);return q;};q.then=resolve=>resolve({data:[{id:'event'}],error:null});
 const api=load('../lib/events.ts',{'./supabase':{supabase:{from:table=>{calls.push(['from',table]);return q;},rpc:async()=>({data:[{event_id:'event',attendee_count:3}],error:null})}},'./businessHours':hours});
 assert.equal((await api.loadEvents(null,null)).length,0);assert.equal((await api.loadEvents('كل المدن',null)).length,0);assert.equal(calls.length,0);
 const rows=await api.loadEvents('الرياض','النرجس',20);
 const city=calls.findIndex(x=>x[0]==='eq'&&x[1]==='city'),district=calls.findIndex(x=>x[0]==='eq'&&x[1]==='district'),page=calls.findIndex(x=>x[0]==='range');
 assert.ok(city>=0&&city<page);assert.ok(district>=0&&district<page);assert.equal(rows[0].attendee_count,3);
 assert.equal(calls.find(x=>x[0]==='select')[1].includes('latitude'),false,'private coordinates are not fetched');
});
test('event attendance never pretends success while the server is offline',async()=>{
 const api=load('../lib/events.ts',{'./supabase':{supabase:{rpc:async()=>({error:{message:'offline'},data:null})}},'./businessHours':hours});
 await assert.rejects(api.setEventAttendance('event',true));
});

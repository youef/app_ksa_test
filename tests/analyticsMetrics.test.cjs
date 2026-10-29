const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const ts=require('typescript');
const Module=require('node:module');
const filename=require.resolve('../lib/analyticsMetrics.ts');
const compiled=new Module(filename);
compiled._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);
const {analyticsSection,riyadhDay,percentChange,conversion,retentionMatrix,createAnalyticsQueue}=compiled.exports;
test('route classification never retains private paths, identifiers or query strings',()=>{
 assert.equal(analyticsSection('/story?id=secret&token=abc'),'stories');
 assert.equal(analyticsSection('/conversation/secret-user'),'other');
 assert.equal(analyticsSection('/admin?secret=abc'),'other');
 assert.equal(analyticsSection('/market?businessId=secret'),'market');
});
test('report boundaries and percentages handle Riyadh midnight and empty comparisons',()=>{
 assert.equal(riyadhDay(new Date('2026-01-01T21:01:00Z')),'2026-01-02');
 assert.equal(percentChange(5,0),null);assert.equal(percentChange(15,10),50);
 assert.equal(conversion(3,4),75);assert.equal(conversion(5,0),null);
});
test('offline navigation remains bounded, retries once per bucket and never blocks its caller',async()=>{
 const sent=[];let online=false;
 const queue=createAnalyticsQueue(async p=>{if(!online)throw new Error('offline');sent.push(p);return true;},'ephemeral');
 queue.identify('actor1');queue.enqueue('home_view',undefined,'2026-01-01');queue.enqueue('home_view',undefined,'2026-01-01');
 await queue.flush();assert.equal(queue.pendingCount,1);
 online=true;await queue.flush();assert.equal(queue.pendingCount,0);assert.equal(sent.length,1);
 queue.enqueue('home_view',undefined,'2026-01-01');await queue.flush();assert.equal(sent.length,1);
 online=false;for(let i=0;i<40;i++)queue.enqueue('app_open',undefined,`day${i}`);
 assert.equal(queue.pendingCount,30);
 queue.identify(null);assert.equal(queue.pendingCount,0);queue.enqueue('app_open');assert.equal(queue.pendingCount,0);
 assert.deepEqual(Object.keys(sent[0]).sort(),['event_key','event_name','properties','session_id']);
});
test('cohort matrix separates weeks and retains incomplete flags',()=>{
 const matrix=retentionMatrix([{cohort_week:'2026-01-05',week_number:1,cohort_size:3,retained_count:1,retention_rate:1/3,complete:false},{cohort_week:'2026-01-05',week_number:0,cohort_size:3,retained_count:2,retention_rate:2/3,complete:true}]);
 assert.equal(matrix[0].values[0].week_number,0);assert.equal(matrix[0].values[1].complete,false);
});

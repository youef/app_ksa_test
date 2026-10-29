#!/usr/bin/env node
// Deterministic engineering agent: no code, production data or deployments are modified.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const repo = process.cwd();
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(repo,p),'utf8'));
const checks=[];
const add=(id,status,message,details='')=>checks.push({id,status,message,details});
function runCommand(id,args,timeout=180000){
 const p=spawnSync(process.platform==='win32'?'npm.cmd':'npm',args,{cwd:repo,encoding:'utf8',timeout,maxBuffer:5*1024*1024,env:{...process.env,CI:'1'}});
 const output=(p.stdout||'')+'\n'+(p.stderr||'');
 add(id,p.status===0?'passed':'failed',p.status===0?args.join(' ')+' completed':args.join(' ')+' failed',output.slice(-3500));
}
const pkg=readJson('package.json'), app=readJson('app.json'), eas=readJson('eas.json');
runCommand('typescript',['run','typecheck']);
runCommand('web-build',['run','build'],300000);
const configured=Boolean(pkg.dependencies?.['expo-updates'] && app.expo?.updates?.url && app.expo?.runtimeVersion && eas.build?.production?.channel);
add('ota-readiness',configured?'passed':'warning',configured?'EAS Update runtime and channels are configured':'OTA is NOT configured: install expo-updates, configure runtimeVersion and channels, rebuild signed binaries');
const native=Boolean(eas.build?.production?.android && eas.build?.testflight?.ios);
add('native-release',native?'passed':'warning',native?'Android APK and iOS IPA build profiles found':'Review Android and iOS build profiles');
const migrationDir=path.join(repo,'supabase','migrations');
const migrationCount=fs.existsSync(migrationDir)?fs.readdirSync(migrationDir).filter(n=>n.endsWith('.sql')).length:0;
add('schema-inventory','passed',migrationCount+' versioned SQL migration files found','Unused tables cannot safely be deleted by code search alone.');
const ACTIONS = {
 typescript: ['Identify the first TypeScript diagnostic', 'Trace the source and introduce a minimal regression-tested fix', 'Verify typecheck and web/native bundles'],
 'web-build': ['Read the failing Metro or Expo build step', 'Find the importing module and fix with web/native separation where needed', 'Run the export again before opening a pull request'],
 'ota-readiness': ['Verify expo-updates package and lockfile', 'Test EAS update channels with a fresh signed binary in preview', 'Release OTA only for a matching runtimeVersion'],
 'native-release': ['Check EAS Android and iOS build profiles', 'Run an authorized preview build', 'Do not publish unverified binaries'],
 'schema-inventory': ['Compare GitHub migrations with live Supabase migration history', 'Validate functions, views and RLS dependencies', 'Record a reversible migration if needed']
};
for(const check of checks) {
 check.plan = ACTIONS[check.id] || ['Reproduce', 'Apply a minimal correction', 'Verify'];
 check.decision = check.status === 'passed' ? 'No code change required' : check.status === 'warning' ? 'Track and verify prerequisites; do not release an untested change' : 'Escalate diagnostic and prepare a tested isolated fix';
 check.cost_tier = 'deterministic';
}
const failed=checks.filter(c=>c.status==='failed');
const warnings=checks.filter(c=>c.status==='warning');
const status=failed.length?'failed':warnings.length?'warning':'passed';
const runUrl=process.env.GITHUB_RUN_ID?'https://github.com/youef/app_ksa_test/actions/runs/'+process.env.GITHUB_RUN_ID:null;
const summary=failed.length?failed.length+' failing engineering checks':warnings.length?warnings.length+' engineering warnings':'Engineering checks passed';
const report={source:'github_actions',run_type:'engineering_audit',status,summary,details:{checks, cadence:'hourly', plan:'diagnose → minimal fix branch → test → PR → verified release', model_budget:'deterministic first; AI only for actionable warnings/failures'},source_url:runUrl,started_at:new Date().toISOString(),finished_at:new Date().toISOString()};
fs.mkdirSync('artifacts',{recursive:true});
fs.writeFileSync('artifacts/hayna-agent-report.json',JSON.stringify(report,null,2));
const markdown=['# HAYNA AI · Engineering Audit','', 'Status: **'+status+'** · '+new Date().toISOString(),'',
...checks.map(c=>'### '+(c.status==='passed'?'✅':c.status==='warning'?'⚠️':'❌')+' '+c.id+'\n'+c.message+'\n'+(c.status==='passed'?'':'\n```text\n'+c.details.slice(0,1800)+'\n```')),
'','This report is diagnostics only. It never changes SQL, code, deployments, feature flags or user accounts.','',runUrl||''].join('\n');
fs.writeFileSync('artifacts/hayna-agent-report.md',markdown);
if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,markdown);
const key=process.env.HAYNA_SUPABASE_SERVICE_ROLE_KEY;
const url=process.env.HAYNA_SUPABASE_URL;
if(key && url){
 try {
  const base=new URL(url);
  if(base.protocol!=='https:' || base.hostname!=='vkeuyompnddqfvulalkk.supabase.co') throw new Error('Unexpected Supabase target');
  const res=await fetch(base.origin+'/rest/v1/ai_agent_runs',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(report),signal:AbortSignal.timeout(12000)});
  if(!res.ok)console.error('Agent report persistence failed: HTTP '+res.status);
 } catch(e){console.error('Agent report persistence failed: '+e.message);}
} else console.log('Optional agent reporting credentials absent; GitHub artifact remains available.');
// Every check has a bounded, non-sensitive execution journal entry. The server role is never bundled in the app.
if(key && url) {
 try {
  const target=new URL(url);
  if(target.origin!=='https://vkeuyompnddqfvulalkk.supabase.co') throw new Error('Unexpected Supabase target');
  const events=checks.map(check=>({
   event_key: process.env.GITHUB_RUN_ID ? 'gh:' + process.env.GITHUB_RUN_ID + ':' + check.id : null,
   source:'github_actions', component:check.id, phase:'hourly_audit',
   status:check.status==='passed'?'verified':check.status==='failed'?'failed':'detected',
   severity:check.status==='failed'?'high':check.status==='warning'?'medium':'info',
   summary:check.message.slice(0,300),decision:check.decision,plan:check.plan,
   details:{check_id:check.id,status:check.status},result:{passed:check.status==='passed'},
   cost_tier:'deterministic',source_url:runUrl
  }));
  const response=await fetch(target.origin+'/rest/v1/ai_agent_events?on_conflict=event_key',{
   method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=minimal'},
   body:JSON.stringify(events),signal:AbortSignal.timeout(12000)
  });
  if(!response.ok)console.error('Audit event journal unavailable: HTTP '+response.status);
  else console.log(events.length+' structured audit journal events recorded.');
 }catch(e){console.error('Audit journal unavailable: '+e.message);}
}
console.log(JSON.stringify({status,failed:failed.length,warnings:warnings.length,runUrl}));
if(failed.length) process.exitCode=1;

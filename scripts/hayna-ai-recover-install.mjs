#!/usr/bin/env node
// Deterministic, narrowly scoped recovery: only npm lockfile drift may produce an auto-PR.
// The script never pushes to main, merges, or releases.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

fs.mkdirSync('artifacts',{recursive:true});
const runId=process.env.GITHUB_RUN_ID || '';
const sourceUrl=runId ? 'https://github.com/youef/app_ksa_test/actions/runs/'+runId : null;
const log=fs.existsSync('artifacts/npm-install.log') ? fs.readFileSync('artifacts/npm-install.log','utf8') : '';
const isLockDrift=/EUSAGE|can only install packages when your package\.json and package-lock\.json are in sync/i.test(log) &&
 /lock file|package-lock\.json/i.test(log);
const check={id:'npm-install',status:'failed',message:isLockDrift?'npm ci failed due to package-lock mismatch':'npm ci failed; needs root-cause analysis',plan:isLockDrift?['Regenerate package-lock.json only','Verify npm ci, TypeScript and Expo web export','Open separate proposed PR']:['Inspect failed npm install logs','Identify the first underlying dependency/network error','Make a minimal tested PR'],decision:'No production changes without verification',cost_tier:'deterministic'};
const outcome={diagnosis:isLockDrift?'lockfile_drift':'unclassified_dependency_failure',attempted:false,validated:false,pull_request:null};
const exec=(args,timeout=240000)=>{
 const x=spawnSync(process.platform==='win32'?'npm.cmd':'npm',args,{encoding:'utf8',timeout,maxBuffer:4*1024*1024,env:{...process.env,CI:'1'}});
 return {ok:x.status===0,description:args.join(' '),exit:x.status,preview:((x.stdout||'')+'\n'+(x.stderr||'')).slice(-900)};
};
const api=async(path,method='GET',payload)=>{
 const response=await fetch('https://api.github.com/repos/youef/app_ksa_test'+path,{
  method,headers:{Authorization:'Bearer '+process.env.GH_TOKEN,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},
  ...(payload?{body:JSON.stringify(payload)}:{}),signal:AbortSignal.timeout(15000)});
 const body=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error('GitHub '+method+' '+path.split('?')[0]+' HTTP '+response.status);
 return body;
};
if(isLockDrift){
 outcome.attempted=true;
 const original=fs.readFileSync('package-lock.json','utf8');
 const regen=exec(['install','--package-lock-only','--ignore-scripts','--no-audit','--no-fund']);
 outcome.regeneration={ok:regen.ok,exit:regen.exit};
 const lock=fs.readFileSync('package-lock.json','utf8');
 if(regen.ok && lock!==original && lock.length<2000000){
  const install=exec(['ci','--ignore-scripts','--no-audit','--no-fund']);
  outcome.reinstall={ok:install.ok,exit:install.exit};
  if(install.ok){
   const typecheck=exec(['run','typecheck']);
   outcome.typecheck={ok:typecheck.ok,exit:typecheck.exit};
   if(typecheck.ok){
    const build=exec(['run','build'],300000);
    outcome.webBuild={ok:build.ok,exit:build.exit};
    outcome.validated=build.ok;
   }
  }
  if(outcome.validated && process.env.GH_TOKEN && process.env.GITHUB_SHA && runId){
   try{
    const branch='agent/lockfile-repair-'+runId;
    await api('/git/refs','POST',{ref:'refs/heads/'+branch,sha:process.env.GITHUB_SHA});
    const old=await api('/contents/package-lock.json?ref=main');
    await api('/contents/package-lock.json','PUT',{message:'fix(deps): regenerate npm lockfile after verified CI drift',content:Buffer.from(lock).toString('base64'),sha:old.sha,branch});
    const pr=await api('/pulls','POST',{title:'fix(deps): verified automated lockfile repair',head:branch,base:'main',draft:true,body:'An hourly check detected an npm ci lockfile mismatch. Only package-lock.json was regenerated with npm install --package-lock-only --ignore-scripts; npm ci, TypeScript and Expo web export passed. No automatic merge or production release. Evidence: '+sourceUrl});
    outcome.pull_request=pr.html_url;
    check.decision='Verified one-file lockfile fix proposed in draft PR; awaiting controlled merge';
   }catch(error){outcome.pullRequestError=String(error.message).slice(0,200);check.decision='Fix validated locally but GitHub PR could not be opened';}
  }
 } else {outcome.regeneration={ok:regen.ok,modified:lock!==original};}
}
check.details={diagnosis:outcome.diagnosis,attempted:outcome.attempted,validated:outcome.validated};
const summary=outcome.pull_request?'Dependency failure diagnosed; safe lockfile fix PR created':outcome.validated?'Dependency failure diagnosed and fix validated; PR blocked':'Dependency installation failed; manual diagnosis is required';
const report={source:'github_actions',run_type:'engineering_audit',status:'failed',summary,details:{checks:[check],autofix:outcome,model_budget:'deterministic first'},source_url:sourceUrl,started_at:new Date().toISOString(),finished_at:new Date().toISOString()};
fs.writeFileSync('artifacts/hayna-agent-report.json',JSON.stringify(report,null,2));
fs.writeFileSync('artifacts/hayna-agent-report.md',['# HAYNA AI · Install Recovery','',summary,'', 'Cause: '+outcome.diagnosis, 'Attempted: '+outcome.attempted,'Validated: '+outcome.validated,'Draft PR: '+(outcome.pull_request||'none'),'','Plan:',...check.plan.map((s,i)=>(i+1)+'. '+s),'',sourceUrl||''].join('\n'));
const key=process.env.HAYNA_SUPABASE_SERVICE_ROLE_KEY,url=process.env.HAYNA_SUPABASE_URL;
if(key&&url)try{
 const target=new URL(url);
 if(target.origin!=='https://vkeuyompnddqfvulalkk.supabase.co')throw new Error('Unexpected Supabase target');
 const headers={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=minimal'};
 const record=await fetch(target.origin+'/rest/v1/ai_agent_runs',{method:'POST',headers,body:JSON.stringify(report),signal:AbortSignal.timeout(12000)});
 if(!record.ok)console.error('Run report persistence HTTP '+record.status);
 const event={event_key:runId?'gh:'+runId+':npm-install':null,component:'npm-install',phase:'recovery',source:'github_actions',status:outcome.validated?'verified':'failed',severity:'high',summary,decision:check.decision,plan:check.plan,details:{diagnosis:outcome.diagnosis},result:outcome,cost_tier:'deterministic',source_url:sourceUrl};
 const saved=await fetch(target.origin+'/rest/v1/ai_agent_events?on_conflict=event_key',{method:'POST',headers:{...headers,Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify(event),signal:AbortSignal.timeout(12000)});
 if(!saved.ok)console.error('Recovery journal HTTP '+saved.status);
}catch(e){console.error('Recovery journal unavailable: '+e.message);}
console.log(JSON.stringify({diagnosis:outcome.diagnosis,validated:outcome.validated,pull_request:outcome.pull_request}));

// Loads metadata-only schema into isolated PostgreSQL. No user rows or auth secrets.
const fs=require('node:fs');
const {createDatabase}=require('./databaseHarness.cjs');
const quote=value=>'"'+value.replaceAll('"','""')+'"';
async function integrationDatabase(){
 const schema=JSON.parse(fs.readFileSync('artifacts/qa-runtime/live-schema.json','utf8'));
 const {pg_trgm}=require('../artifacts/qa-runtime/node_modules/@electric-sql/pglite/dist/contrib/pg_trgm.cjs');
 const db=await createDatabase({extensions:{pg_trgm}});
 await db.exec(`set check_function_bodies=false; create schema private; create schema storage; create table storage.buckets(id text primary key, public boolean); create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid,metadata jsonb);
 create extension pg_trgm;
 create function public.uuid_generate_v4() returns uuid language sql volatile as $$select gen_random_uuid()$$;
 create function extensions.uuid_generate_v4() returns uuid language sql volatile as $$select gen_random_uuid()$$;`);
 for(const type of schema.enums)await db.exec(`create type ${quote(type.schema)}.${quote(type.name)} as enum(${type.labels.map(x=>"'"+x.replaceAll("'","''")+"'").join(',')})`);
 for(const seq of schema.sequences)await db.exec(`create sequence ${quote(seq.schema)}.${quote(seq.name)}`);
 for(const table of schema.tables){
  const columns=table.columns.map(column=>`${quote(column.name)} ${column.type}${column.default ? (['search_vector','retention_rate','total_estimated'].includes(column.name) ? ' generated always as ('+column.default+') stored' : ' default '+column.default) : ''}${column.notnull?' not null':''}`);
  try {await db.exec(`create table public.${quote(table.name)}(${columns.join(',')})`);}catch(error){throw new Error('Table '+table.name+': '+error.message);}
 }
 for(const table of schema.tables)for(const constraint of table.constraints.filter(x=>x.type!=='f'))await db.exec(`alter table public.${quote(table.name)} add constraint ${quote(constraint.name)} ${constraint.def}`);
 for(const table of schema.tables)for(const constraint of table.constraints.filter(x=>x.type==='f'))await db.exec(`alter table public.${quote(table.name)} add constraint ${quote(constraint.name)} ${constraint.def}`);
 for(const fn of schema.functions){try{await db.exec(fn.def);}catch(error){throw new Error('Function '+fn.name+': '+error.message);}}
 let pending=[...schema.views];for(let attempt=0;pending.length&&attempt<10;attempt++){
  const remaining=[];for(const view of pending){try{await db.exec(`create view public.${quote(view.name)}${view.options?.length?' with('+view.options.join(',')+')':''} as ${view.def}`);}catch(error){remaining.push(view);if(attempt===9)throw new Error('View '+view.name+': '+error.message);}}pending=remaining;
 }
 for(const index of schema.indexes)await db.exec(index);
 for(const policy of schema.policies){
  await db.exec(`create policy ${quote(policy.policyname)} on public.${quote(policy.tablename)} as ${policy.permissive} for ${policy.cmd} to ${policy.roles.map(quote).join(',')}${policy.qual?' using('+policy.qual+')':''}${policy.with_check?' with check('+policy.with_check+')':''}`);
 }
 for(const table of schema.tables)if(table.rls)await db.exec(`alter table public.${quote(table.name)} enable row level security`);
 for(const trigger of schema.triggers)await db.exec(trigger.def);
 // Snapshot intentionally models the previous broad grants so migrations must narrow them.
 await db.exec('grant select,insert,update,delete,truncate,references,trigger on all tables in schema public to anon,authenticated,service_role; grant usage,select on all sequences in schema public to anon,authenticated,service_role;');
 return db;
}
module.exports={integrationDatabase};
if(require.main===module)integrationDatabase().then(async db=>{console.log('Isolated live schema loaded');await db.close()}).catch(error=>{console.error(error.message);process.exitCode=1});

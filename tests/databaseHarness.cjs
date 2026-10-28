// Real, isolated PostgreSQL (WASM). Never connects to the production database.
const fs = require('node:fs');
const path = require('node:path');
function loadPGlite() {
  try { return require('@electric-sql/pglite').PGlite; }
  catch { return require('../artifacts/qa-runtime/node_modules/@electric-sql/pglite').PGlite; }
}
function sql(value) {
  if (!value) return '';
  if (Array.isArray(value)) return value.map(sql).join('\n');
  return typeof value === 'string' && fs.existsSync(value) && fs.statSync(value).isFile() ? fs.readFileSync(value, 'utf8') : value;
}
async function createDatabase({ schema = '', migration = '', fixtures = '', extensions = {} } = {}) {
  const PGlite = loadPGlite();
  const db = new PGlite({extensions});
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create schema app_private;
    create schema extensions;
    create table auth.users(id uuid primary key default gen_random_uuid(), created_at timestamptz default now());
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
    $$;
    create function auth.role() returns text language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),'anon');
    $$;
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)
        || jsonb_build_object('sub',auth.uid(),'role',auth.role());
    $$;
    grant usage on schema public,auth to anon,authenticated,service_role;
    grant execute on all functions in schema auth to anon,authenticated,service_role;
  `);
  if (sql(schema)) await db.exec(sql(schema));
  if (sql(migration)) await db.exec(sql(migration));
  if (sql(fixtures)) await db.exec(sql(fixtures));
  return db;
}
async function asUser(db, id, role = 'authenticated') {
  if (!['anon','authenticated','service_role'].includes(role)) throw new Error('Invalid test role');
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false), set_config('request.jwt.claim.role',$2,false)", [id || '', role]);
  await db.exec(`set role ${role}`);
}
module.exports = { createDatabase, asUser, sql, root: path.resolve(__dirname, '..') };

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createDatabase, asUser } = require('./databaseHarness.cjs');

const id = n => `70000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const migration = fs.readFileSync('supabase/migrations/20261101121000_order_notification_preferences_least_privilege.sql', 'utf8');

test('order notification preferences enforce least-privilege ACLs without breaking owner access', async t => {
  const schema = `
    create table public.order_notification_preferences(
      user_id uuid primary key references auth.users(id),
      in_app_enabled boolean not null default true,
      push_enabled boolean not null default true
    );
    alter table public.order_notification_preferences enable row level security;
    grant all privileges on public.order_notification_preferences to anon, authenticated;
    create policy own_read on public.order_notification_preferences for select to authenticated
      using(user_id=(select auth.uid()));
    create policy own_insert on public.order_notification_preferences for insert to authenticated
      with check(user_id=(select auth.uid()));
    create policy own_update on public.order_notification_preferences for update to authenticated
      using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
    insert into auth.users(id) values ('${id(1)}'), ('${id(2)}');
  `;
  const db = await createDatabase({ schema, migration });
  t.after(() => db.close());

  for (const role of ['anon', 'authenticated']) {
    for (const privilege of ['DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) {
      const result = await db.query(
        "select has_table_privilege($1, 'public.order_notification_preferences', $2) as allowed",
        [role, privilege]
      );
      assert.equal(result.rows[0].allowed, false, `${role} must not have ${privilege}`);
    }
  }
  for (const privilege of ['SELECT', 'INSERT', 'UPDATE']) {
    const result = await db.query(
      "select has_table_privilege('authenticated', 'public.order_notification_preferences', $1) as allowed",
      [privilege]
    );
    assert.equal(result.rows[0].allowed, true, `authenticated needs ${privilege}`);
    const anonymous = await db.query(
      "select has_table_privilege('anon', 'public.order_notification_preferences', $1) as allowed",
      [privilege]
    );
    assert.equal(anonymous.rows[0].allowed, false, `anon must not have ${privilege}`);
  }

  await asUser(db, null, 'anon');
  await assert.rejects(db.query('select * from public.order_notification_preferences'), /permission denied/i);

  await asUser(db, id(1));
  await db.query('insert into public.order_notification_preferences(user_id) values ($1)', [id(1)]);
  await db.query('update public.order_notification_preferences set push_enabled=false where user_id=$1', [id(1)]);
  assert.equal((await db.query('select push_enabled from public.order_notification_preferences')).rows[0].push_enabled, false);
  await assert.rejects(db.query('truncate public.order_notification_preferences'), /permission denied/i);

  await asUser(db, id(2));
  assert.equal((await db.query('select * from public.order_notification_preferences')).rows.length, 0);
  assert.equal((await db.query('update public.order_notification_preferences set push_enabled=true where user_id=$1', [id(1)])).rowCount, 0);
  await db.query('insert into public.order_notification_preferences(user_id) values ($1)', [id(2)]);
  assert.equal((await db.query('select * from public.order_notification_preferences')).rows.length, 1);
});

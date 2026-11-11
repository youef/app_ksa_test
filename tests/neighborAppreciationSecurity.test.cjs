'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migration = fs.readFileSync(
  path.join(__dirname, '..', 'supabase', 'migrations', '202610310025_neighbor_appreciation_guard.sql'),
  'utf8'
);

test('both sender and recipient must belong to the same conversation', () => {
  assert.match(migration, /cm\.conversation_id = p_conversation_id and cm\.user_id = v_sender/);
  assert.match(migration, /cm\.conversation_id = p_conversation_id and cm\.user_id = p_recipient_id/);
  assert.match(migration, /recipient_not_conversation_member/);
});

test('unique daily ledger and serialized sender limit prevent repeat points', () => {
  assert.match(migration, /primary key \(sender_id, recipient_id, conversation_id, award_day\)/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /v_sent_today >= 10/);
  assert.match(migration, /on conflict do nothing/);
  assert.match(migration, /appreciation_already_sent_today/);
  assert.ok(migration.indexOf('insert into app_private.neighbor_appreciation_daily') <
    migration.indexOf('insert into public.messages'), 'reserve before creating messages');
});

test('ledger is private and the RPC is authenticated-only', () => {
  assert.match(migration, /alter table app_private\.neighbor_appreciation_daily enable row level security/);
  assert.match(migration, /revoke all on table app_private\.neighbor_appreciation_daily from public, anon, authenticated/);
  assert.match(migration, /revoke all on function public\.send_neighbor_appreciation\(uuid, uuid, text\) from public, anon/);
  assert.match(migration, /grant execute on function public\.send_neighbor_appreciation\(uuid, uuid, text\) to authenticated/);
  assert.match(migration, /set search_path = pg_catalog, public, app_private/);
});

test('the client never bypasses a rejected appreciation RPC', () => {
  const screen = fs.readFileSync(path.join(__dirname, '..', 'app', 'conversation.tsx'), 'utf8');
  const start = screen.indexOf('  async function sendAppreciation(');
  const end = screen.indexOf('  async function shareExactLocation(', start);
  assert.ok(start >= 0 && end > start, 'appreciation handler must exist');
  const handler = screen.slice(start, end);
  assert.ok(handler.includes('if (rpcErr) throw rpcErr;'));
  assert.ok(!handler.includes(".from('reputation').upsert"));
  assert.ok(!handler.includes(".from('messages').insert"));
});

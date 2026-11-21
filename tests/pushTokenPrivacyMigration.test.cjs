const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migration = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261101210000_restrict_push_token_read.sql'), 'utf8');

test('revokes broad push token select access', () => {
  assert.match(migration, /DROP POLICY IF EXISTS "Authenticated users can read tokens for notifications" ON public\.push_tokens/i);
});
test('keeps existing owner policies intact', () => {
  assert.doesNotMatch(migration, /DROP POLICY[^;]*(Users can manage own tokens|push tokens own)/i);
});
test('migration fails closed if another unrestricted policy exists', () => {
  assert.match(migration, /RAISE EXCEPTION 'Broad push token SELECT policy still exists'/);
});

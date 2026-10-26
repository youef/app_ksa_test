const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '..', file);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const mod = new Module(filename);
  mod.require = name => name in mocks ? mocks[name] : require(name);
  mod._compile(compiled.outputText, filename);
  return mod.exports;
}
const phone = load('lib/contactPhone.ts');

test('Saudi local, Arabic, Persian, and international numbers normalize for calls', () => {
  for (const input of ['055 555 0101', '٠٥٥٥٥٥٠١٠١', '۰۵۵۵۵۵۰۱۰۱', '+966 (55) 555-0101', '00966555550101', '966555550101']) {
    assert.equal(phone.normalizeContactPhone(input), '+966555550101', input);
  }
  assert.equal(phone.normalizeContactPhone('+1 (555) 555-0101'), '+15555550101');
  assert.equal(phone.normalizeContactPhone('   '), '');
});
test('malformed numbers and non-phone URLs never become callable', () => {
  for (const input of ['0555', '05555501010', '+9661555550101', '0555550101ext4', 'tel:0555550101', 'javascript:alert(1)', '++15555550101', '+0123456789', '+1234567890123456']) {
    assert.equal(phone.normalizeContactPhone(input), null, input);
  }
});

function api(result, { actor = 'owner', loaded = null, readError = null } = {}) {
  const calls = [];
  const query = {
    select(fields) { calls.push(['select', fields]); return this; },
    eq(...args) { calls.push(['eq', ...args]); return this; },
    upsert(row) { calls.push(['upsert', row]); return this; },
    delete() { calls.push(['delete']); return this; },
    single: async () => result,
    maybeSingle: async () => ({ data: loaded, error: readError }),
    then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
  };
  const supabase = { from(table) { assert.equal(table, 'profile_contact_numbers'); return query; }, auth: { getUser: async () => ({ data: { user: { id: actor } }, error: null }) } };
  return { calls, ...load('lib/profileContact.ts', { '@/lib/supabase': { supabase }, '@/lib/contactPhone': phone }) };
}

test('saving normalizes the number and verifies the persisted hidden state', async () => {
  const row = { user_id: 'owner', phone: '+966555550101', is_visible: false };
  const client = api({ data: row, error: null });
  assert.deepEqual(await client.saveProfileContact('owner', '٠٥٥٥٥٥٠١٠١', false), row);
  const payload = client.calls.find(call => call[0] === 'upsert')[1];
  assert.equal(payload.phone, row.phone);
  assert.equal(payload.is_visible, false);
});
test('silent no-row writes, network errors, and account changes are not success', async () => {
  await assert.rejects(api({ data: null, error: null }).saveProfileContact('owner', '+15555550101', true));
  await assert.rejects(api({ data: null, error: new Error('denied') }).saveProfileContact('owner', '+15555550101', true));
  await assert.rejects(api({}, { actor: 'someone-else' }).saveProfileContact('owner', '+15555550101', true));
});
test('clearing a number verifies its deletion and does not create a blank row', async () => {
  const client = api({ data: null, error: null });
  assert.equal(await client.saveProfileContact('owner', '', true), null);
  assert.ok(client.calls.some(call => call[0] === 'delete'));
  assert.ok(!client.calls.some(call => call[0] === 'upsert'));
  await assert.rejects(api({ error: null }, { loaded: { phone: '+15555550101' } }).saveProfileContact('owner', '', false));
});
test('public reads require visibility and surface permission failures', async () => {
  const client = api({});
  assert.equal(await client.loadProfileContact('owner', true), null);
  assert.ok(client.calls.some(call => call[0] === 'eq' && call[1] === 'is_visible' && call[2] === true));
  await assert.rejects(api({}, { readError: new Error('denied') }).loadProfileContact('owner'));
});

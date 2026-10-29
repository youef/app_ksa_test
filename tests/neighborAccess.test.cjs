const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function loadAccess(rpc) {
  const source = ts.transpileModule(fs.readFileSync('lib/neighborAccess.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, { exports, require(name) {
    assert.equal(name, './supabase');
    return { supabase: { rpc } };
  } });
  return exports.getNeighborAccess;
}

test('profile lookup uses the city boundary independently of neighborhood filters', async () => {
  const getAccess = loadAccess(async (name, args) => {
    assert.equal(name, 'hayna_neighbor_access');
    assert.equal(args.p_lookup, 'neighbor_in_another_district');
    assert.equal(args.p_scope, 'city');
    return { data: { can_view: true, can_message: false, target_id: 'neighbor-id' }, error: null };
  });
  const result = await getAccess('neighbor_in_another_district');
  assert.equal(result.can_view, true);
  assert.equal(result.can_message, false);
  assert.equal(result.target_id, 'neighbor-id');
});

test('server denial for another city or privacy restriction stays denied', async () => {
  const getAccess = loadAccess(async () => ({ data: { can_view: false, can_message: false }, error: null }));
  const result = await getAccess('unavailable-neighbor');
  assert.equal(result.can_view, false);
  assert.equal(result.can_message, false);
  assert.equal(result.target_id, null);
});

test('failed access requests are surfaced instead of granting access', async () => {
  const failure = new Error('Network failure');
  const getAccess = loadAccess(async () => ({ data: null, error: failure }));
  await assert.rejects(getAccess('neighbor'), error => error === failure);
});

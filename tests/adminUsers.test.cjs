const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync('supabase/functions/admin-users/index.ts', 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const exportsUnderTest = {};
vm.runInNewContext('(function(require,exports){' + code + '})', {Response})((name) => ({withSupabase: (_config, handler) => handler}), exportsUnderTest);
const handle = exportsUnderTest.default.fetch;
function context(role, is_banned = false) {
  const calls = [];
  return {calls, ctx:{userClaims:{id:'actor'},supabaseAdmin:{
    from:() => ({select:() => ({eq:() => ({single:async() => ({data:{role,is_banned}})})})}),
    auth:{admin:{deleteUser:async(...args) => {calls.push(args); return {};}}}
  }}};
}
const request = body => ({method:'POST',json:async()=>body});
test('banned admins and moderators cannot delete accounts', async () => {
  for (const [role,banned] of [['admin',true],['moderator',false],['user',false]]) {
    const {ctx,calls}=context(role,banned);
    assert.equal((await handle(request({action:'delete',id:'target'}),ctx)).status,403);
    assert.equal(calls.length,0);
  }
});
test('admin deletion uses the SDK soft-delete boolean and refuses self-deletion', async () => {
  const {ctx,calls}=context('admin');
  assert.equal((await handle(request({action:'delete',id:'actor'}),ctx)).status,400);
  assert.equal((await handle(request({action:'delete',id:'target'}),ctx)).status,200);
  assert.deepEqual(calls,[['target',true]]);
});

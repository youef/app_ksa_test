const test = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, filename);
const { isActiveStory, storyExpiryFilter, matchesStoryScope } = require('../lib/storyActivity.ts');
const now = Date.parse('2026-10-21T12:00:00Z');
test('expiry uses the stored expiration and falls back to 24 hours only when absent', () => {
  assert.equal(isActiveStory({ created_at: '2026-10-20T12:00:00Z' }, now), false);
  assert.equal(isActiveStory({ created_at: '2026-10-20T12:00:01Z' }, now), true);
  assert.equal(isActiveStory({ created_at: '2026-10-21T11:00:00Z', expires_at: '2026-10-21T12:00:00Z' }, now), false);
  assert.equal(isActiveStory({ created_at: 'invalid' }, now), false);
  assert.equal(storyExpiryFilter(true, now).includes('expires_at.lte.'), true);
});
test('scope filters separate own stories, following and unseen neighbors', () => {
  const mine = { id: 'mine', author_id: 'me', profiles: { district: 'النخيل' } };
  const neighbor = { id: 'new', author_id: 'neighbor', profiles: { district: 'النخيل' } };
  const matches = (row, scope, seen = []) => matchesStoryScope(row, scope, 'me', ['neighbor'], seen, ' النخيل ');
  assert.equal(matches(mine, 'mine'), true);
  assert.equal(matches(mine, 'unseen'), false);
  assert.equal(matches(neighbor, 'following'), true);
  assert.equal(matches(neighbor, 'unseen', ['new']), false);
  assert.equal(matches(neighbor, 'district'), true);
  assert.equal(matchesStoryScope(neighbor, 'district', 'me', [], [], ''), false);
});
const { storyDiscoveryMembership } = require('../lib/storyActivity.ts');
test('neighborhood rings and city trends are independent, including authors without a district', () => {
 const scope = (author, id = 'other', follows = []) => storyDiscoveryMembership(author, id, 'me', follows, 'عرعر', 'الخليج الشرقي');
 assert.deepEqual(scope({city:'عرعر',district:null}), {ring:false,trending:true});
 assert.deepEqual(scope({city:'عرعر',district:null},'me'), {ring:true,trending:true});
 assert.deepEqual(scope({city:'عرعر',district:null},'friend',['friend']), {ring:true,trending:true});
 assert.deepEqual(scope({city:'الرياض',district:'الخليج الشرقي'}), {ring:false,trending:false});
 assert.deepEqual(scope({city:'الرياض'},'friend',['friend']), {ring:true,trending:false});
 assert.deepEqual(scope({city:'عرعر',district:'الخليج الشرقي'}), {ring:true,trending:true});
 assert.deepEqual(storyDiscoveryMembership({city:'عرعر'},'other','me',[],'',''),{ring:false,trending:false});
});
const { prioritizeUnseenStoryGroups, unseenStories } = require('../lib/storyActivity.ts');
test('watched authors move behind every unseen author even when followed or more recent', () => {
 const rows = [{id:'followed-seen',hasUnseen:false,rank:100},{id:'new',hasUnseen:true,rank:1},{id:'new-followed',hasUnseen:true,rank:10},{id:'old-seen',hasUnseen:false,rank:1}];
 assert.deepEqual(prioritizeUnseenStoryGroups(rows,(a,b)=>b.rank-a.rank).map(r=>r.id),['new-followed','new','followed-seen','old-seen']);
 assert.equal(rows[0].id,'followed-seen');
});
test('only unwatched slides remain and a partially viewed author still has fresh slides', () => {
 const rows=[{id:'old'},{id:'fresh'},{id:'later'}];
 assert.deepEqual(unseenStories(rows,['old','later']).map(r=>r.id),['fresh']);
 assert.deepEqual(unseenStories(rows,['old','fresh','later']),[]);
 assert.equal(rows.length,3);
});

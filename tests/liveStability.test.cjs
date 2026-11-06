'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', 'app', file), 'utf8');

test('live creation blocks rapid duplicate submits before awaiting auth', () => {
  const source = read('live/create.tsx');
  assert.match(source, /if \(startingRef\.current\) return;/);
  assert.ok(source.indexOf('startingRef.current = true;') < source.indexOf('await supabase.auth.getUser()'));
  assert.match(source, /finally \{\s*startingRef\.current = false;/);
  assert.match(source, /disabled=\{starting \|\| title\.trim\(\)\.length < 3\}/);
});

test('live creation keeps recoverable validation errors in context', () => {
  const source = read('live/create.tsx');
  assert.match(source, /setFormError\('أضف مدينتك/);
  assert.match(source, /accessibilityRole="alert"/);
  assert.match(source, /KeyboardAvoidingView/);
});

test('live chat respects readers who scroll away from newest comments', () => {
  const source = read('live/[id].tsx');
  assert.match(source, /chatFollowLatestRef\.current = contentSize\.height/);
  assert.match(source, /if \(chatFollowLatestRef\.current\) scrollRef\.current\?\.scrollToEnd/);
});

test('directory refresh preserves current list instead of blanking screen', () => {
  const source = read('lives.tsx');
  const refresh = source.split('const reload = useCallback(')[1]?.split('const spotlight')[0];
  assert.ok(refresh);
  assert.match(refresh, /setRefreshing\(true\)/);
  assert.doesNotMatch(refresh, /setLoading\(true\)/);
});

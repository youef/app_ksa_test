'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const read = file => readFileSync(join(__dirname, '..', file), 'utf8');
test('bottom nav floats above wallpaper as a fully rounded frosted capsule', () => {
  const nav = read('components/BottomNav.tsx');
  assert.match(nav, /borderRadius: 999/);
  assert.match(nav, /height: BOTTOM_NAV_HEIGHT/);
  assert.match(nav, /\{ bottom: safeBottom \}/);
  assert.match(nav, /<BlurView intensity=\{75\}/);
  assert.doesNotMatch(nav, /paddingBottom: safeBottom/);
  assert.doesNotMatch(nav, /borderBottomLeftRadius: 0/);
  assert.match(nav, /createIcon: \{[^\n]+borderRadius: 20/);
});
test('the wallpaper fills the viewport behind the capsule', () => {
  const layout = read('app/_layout.tsx');
  const background = read('components/shared/AppBackground.tsx');
  assert.match(layout, /<AppBackground style=\{\{ flex: 1 \}\}>/);
  assert.match(layout, /#root \{ position: fixed; inset: 0; width: 100%; height: auto/);
  assert.match(background, /StyleSheet\.absoluteFillObject, \{ opacity: background\.opacity \}/);
  assert.match(background, /document\.documentElement, document\.body/);
});

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../lib/bottomNav.ts'), 'utf8');
const nav = fs.readFileSync(path.join(__dirname, '../components/BottomNav.tsx'), 'utf8');
test('web PWA leaves a safe wallpaper gap under the floating dock', () => {
  assert.match(source, /platform === 'web'\) return 36/);
  assert.match(source, /BOTTOM_NAV_HEIGHT = 68/);
  assert.match(nav, /\{ bottom: safeBottom \}/);
  assert.match(nav, /height: BOTTOM_NAV_HEIGHT/);
  assert.doesNotMatch(nav, /height: BOTTOM_NAV_HEIGHT \+ safeBottom/);
  assert.doesNotMatch(nav, /paddingBottom: safeBottom/);
});
test('capsule is inset at both sides and all four corners are rounded', () => {
  assert.match(nav, /paddingHorizontal: 14/);
  assert.match(nav, /borderRadius: 999/);
  assert.match(nav, /webFixedDock/);
  assert.match(nav, /rgba\(255,255,255,\.60\)/);
  assert.match(nav, /activeTab: \{ backgroundColor: '#047857'/);
});

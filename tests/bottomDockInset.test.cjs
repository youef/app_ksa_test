'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../lib/bottomNav.ts'), 'utf8');
const nav = fs.readFileSync(path.join(__dirname, '../components/BottomNav.tsx'), 'utf8');
test('web bottom safe-area cannot cause an enormous footer on iPhone', () => {
  assert.match(source, /platform === 'web'\) return 24/);
  assert.match(source, /Math\.min\(Math\.max\(safe, 8\), 34\)/);
  assert.match(source, /BOTTOM_NAV_HEIGHT = 68/);
  assert.match(nav, /height: BOTTOM_NAV_HEIGHT \+ safeBottom/);
  assert.match(nav, /paddingBottom: safeBottom/);
});
test('bottom sheet is attached to the viewport and remains translucent', () => {
  assert.match(nav, /bottom: 0, zIndex: 100/);
  assert.match(nav, /webFixedDock/);
  assert.match(nav, /rgba\(16,32,27,\.25\)/);
});

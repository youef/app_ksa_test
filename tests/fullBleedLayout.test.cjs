'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const read = (path) => readFileSync(join(__dirname, '..', path), 'utf8');

test('bottom navigation is a rounded glass sheet reaching the device bottom', () => {
  const nav = read('components/BottomNav.tsx');
  assert.match(nav, /borderTopLeftRadius: 32/);
  assert.match(nav, /borderBottomLeftRadius: 0/);
  assert.match(nav, /height: BOTTOM_NAV_HEIGHT \+ safeBottom/);
  assert.match(nav, /paddingBottom: safeBottom/);
  assert.match(nav, /webFixedDock/);
  assert.match(nav, /<BlurView intensity=\{80\}/);
  assert.doesNotMatch(nav, /edgeSurface|edgeDock|edgeToEdge/);
  assert.match(nav, /createIcon: \{[^\n]+borderRadius: 20/);
});

test('application shell is full bleed with background behind safe-area content', () => {
  const layout = read('app/_layout.tsx');
  const background = read('components/shared/AppBackground.tsx');
  const header = read('components/shared/AppHeader.tsx');
  assert.match(layout, /<AppBackground style=\{\{ flex: 1 \}\}>/);
  assert.match(layout, /#root \{ position: fixed; inset: 0; width: 100%; height: auto/);
  assert.doesNotMatch(layout, /maxWidth: path\.startsWith\('\/admin'\)/);
  assert.doesNotMatch(layout, /padding-left: env\(safe-area-inset-left/);
  assert.match(background, /StyleSheet\.absoluteFillObject, \{ opacity: background\.opacity \}/);
  assert.match(header, /paddingLeft: safeArea \? insets\.left : 0/);
});

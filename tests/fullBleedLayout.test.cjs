'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const read = (path) => readFileSync(join(__dirname, '..', path), 'utf8');

test('bottom navigation is a floating rounded pill on every platform', () => {
  const nav = read('components/BottomNav.tsx');
  assert.match(nav, /borderRadius: 999/);
  assert.match(nav, /paddingBottom: bottomPadding/);
  assert.match(nav, /<BlurView intensity=\{80\}/);
  assert.doesNotMatch(nav, /edgeSurface|edgeDock|edgeToEdge/);
  assert.match(nav, /createIcon: \{[^\n]+borderRadius: 20/);
});

test('application shell is full bleed with background behind safe-area content', () => {
  const layout = read('app/_layout.tsx');
  const background = read('components/shared/AppBackground.tsx');
  const header = read('components/shared/AppHeader.tsx');
  assert.match(layout, /<AppBackground style=\{\{ flex: 1 \}\}>/);
  assert.match(layout, /#root \{ width: 100%; height: 100%/);
  assert.match(layout, /height: 100dvh/);
  assert.doesNotMatch(layout, /maxWidth: path\.startsWith\('\/admin'\)/);
  assert.doesNotMatch(layout, /padding-left: env\(safe-area-inset-left/);
  assert.match(background, /StyleSheet\.absoluteFillObject, \{ opacity: background\.opacity \}/);
  assert.match(header, /paddingLeft: safeArea \? insets\.left : 0/);
});

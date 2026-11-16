'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
test('the document wallpaper extends behind the iOS PWA lower safe area', () => {
  const source = read('components/shared/AppBackground.tsx');
  assert.match(source, /const nodes = \[document\.documentElement, document\.body\]/);
  assert.match(source, /node\.style\.backgroundImage = wallpaper/);
  assert.match(source, /node\.style\.backgroundPosition = 'center bottom'/);
  assert.match(source, /background\.opacity/);
  assert.match(source, /return \(\) => nodes\.forEach/);
  assert.match(read('app/_layout.tsx'), /min-height: 100lvh/);
  assert.match(read('app/+html.tsx'), /min-height: 100lvh/);
  assert.match(read('scripts/hayna-web-html.mjs'), /min-height:100lvh/);
});
test('home panels have 12pt side gutters while the wallpaper remains full bleed', () => {
  const home = read('app/home.tsx');
  assert.equal((home.match(/Math\.max\(12, insets\.left, insets\.right\)/g) || []).length, 4);
  assert.match(home, /feed: \{ width: '100%', marginTop: 0, paddingHorizontal: 0/);
  assert.match(read('components/shared/AppBackground.tsx'), /StyleSheet\.absoluteFillObject/);
});

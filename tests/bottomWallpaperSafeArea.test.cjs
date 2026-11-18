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
  assert.match(read('app/_layout.tsx'), /height: 100vh; min-height: 100vh/);
  assert.match(read('app/+html.tsx'), /height: 100vh; min-height: 100vh/);
  assert.match(read('scripts/hayna-web-html.mjs'), /height:100vh;min-height:100vh/);
  assert.match(read('app/_layout.tsx'), /@media \(display-mode: standalone\) \{ #root \{ height: 100vh; bottom: auto; \} \}/);
  assert.match(read('scripts/hayna-web-html.mjs'), /background-position:center bottom/);
});
test('home sections and the self-contained announcement retain single side gutters', () => {
  const home = read('app/home.tsx');
  assert.equal((home.match(/Math\.max\(12, insets\.left, insets\.right\)/g) || []).length, 3);
  assert.match(read('components/home/CommunityShortcuts.tsx'), /paddingHorizontal: 16/);
  assert.doesNotMatch(home, /<View style=\{\{ paddingHorizontal: Math\.max\(12, insets\.left, insets\.right\) \}\}>\s*<CommunityShortcuts/);
  assert.match(home, /feed: \{ width: '100%', marginTop: 0, paddingHorizontal: 0/);
  assert.match(read('components/shared/AppBackground.tsx'), /StyleSheet\.absoluteFillObject/);
});

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const lock = require('../package-lock.json');

// GHSA-pqg4-j6r4-53mv / CVE-2026-102422 affects >=1.8.4 <1.11.0.
// The lockfile must never resolve the vulnerable shell-quote release.
function isPatched(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version || '');
  if (!match) return false;
  const [major, minor, patch] = match.slice(1).map(Number);
  return major > 1 || (major === 1 && (minor > 11 || (minor === 11 && patch >= 0)));
}

test('every installed shell-quote version is patched against GHSA-pqg4-j6r4-53mv', () => {
  const entries = Object.entries(lock.packages || {}).filter(([path]) =>
    path === 'node_modules/shell-quote' || path.endsWith('/node_modules/shell-quote')
  );
  assert.ok(entries.length > 0, 'shell-quote must be present in the lockfile');
  for (const [path, pkg] of entries) {
    assert.ok(isPatched(pkg.version), `${path} resolves vulnerable version ${pkg.version}`);
    assert.match(pkg.resolved || '', /^https:\/\/registry\.npmjs\.org\/shell-quote\/-\/shell-quote-[\d.]+\.tgz$/);
    assert.match(pkg.integrity || '', /^sha512-[A-Za-z0-9+/]+={0,2}$/);
  }
});

test('the existing react-devtools-core dependency accepts the patched release', () => {
  const parent = lock.packages['node_modules/react-devtools-core'];
  assert.ok(parent, 'expected react-devtools-core transitive parent');
  assert.equal(parent.dependencies['shell-quote'], '^1.6.1');
  assert.equal(lock.packages['node_modules/shell-quote'].version, '1.11.0');
});

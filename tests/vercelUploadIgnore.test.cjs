const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const patterns = fs.readFileSync(path.join(__dirname, '..', '.vercelignore'), 'utf8')
  .split(/\r?\n/)
  .map(line => line.trim())
  .filter(line => line && !line.startsWith('#'));

test('Vercel excludes generated QA artifacts to stay below upload request quota', () => {
  assert.ok(patterns.includes('artifacts/'), 'Generated artifacts/ must not be uploaded');
});

test('Vercel still includes runtime static assets and API routes', () => {
  for (const runtimePath of ['public', 'public/', 'api', 'api/', 'app', 'app/', 'lib', 'lib/']) {
    assert.ok(!patterns.includes(runtimePath), runtimePath + ' must remain deployable');
  }
});

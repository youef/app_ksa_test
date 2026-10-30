'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
const globalRule = config.headers.find((rule) => rule.source === '/(.*)');
const header = (name) => globalRule?.headers.find((item) => item.key.toLowerCase() === name.toLowerCase())?.value;

test('global web responses enforce safe MIME sniffing and referrer policies', () => {
  assert.ok(globalRule, 'expected a catch-all response header rule');
  assert.equal(header('X-Content-Type-Options'), 'nosniff');
  assert.equal(header('Referrer-Policy'), 'strict-origin-when-cross-origin');
});

test('static cache headers and SPA rewrite are preserved', () => {
  assert.equal(config.rewrites.find((rule) => rule.destination === '/index.html')?.source, '/((?!api/.*).*)');
  const immutable = config.headers.filter((rule) => rule.headers.some((item) => item.key === 'Cache-Control' && item.value.includes('immutable')));
  assert.equal(immutable.length, 2);
  assert.ok(immutable.some((rule) => rule.source.includes('/_expo/static/')));
  assert.ok(immutable.some((rule) => rule.source.includes('woff2')));
});

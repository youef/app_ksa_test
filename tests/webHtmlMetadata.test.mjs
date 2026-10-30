import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureHaynaWebMetadata } from '../scripts/hayna-web-html.mjs';

const expoHtml = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>حيّنا</title></head><body><div id="root"></div><script src="/_expo/static/js/web/entry.js" defer></script></body></html>';

test('single-output Expo HTML gains Arabic language and installable web metadata', () => {
  const result = ensureHaynaWebMetadata(expoHtml);
  assert.match(result, /<html lang="ar">/);
  for (const tag of ['description', 'theme-color', 'apple-mobile-web-app-capable', 'apple-mobile-web-app-title']) {
    assert.match(result, new RegExp('name="' + tag + '"'));
  }
  assert.match(result, /rel="manifest" href="\/manifest\.json"/);
  assert.match(result, /rel="apple-touch-icon"/);
  assert.match(result, /<script src="\/_expo\/static\/js\/web\/entry\.js" defer><\/script>/);
});

test('repeated post-processing is idempotent and preserves an existing direction', () => {
  const original = expoHtml.replace('lang="en"', 'lang="en" dir="rtl"');
  const first = ensureHaynaWebMetadata(original);
  assert.match(first, /dir="rtl"/);
  assert.equal(ensureHaynaWebMetadata(first), first);
});

test('does not silently accept malformed export', () => {
  assert.throws(() => ensureHaynaWebMetadata('<html><body></body></html>'), /missing html\/head/);
});

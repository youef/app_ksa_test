'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const screen = fs.readFileSync(path.join(__dirname, '../app/contact-us.tsx'), 'utf8');

test('contact form has a clear accessible intro and theme-aware responsive card', () => {
  assert.match(screen, /رسالتك لفريق حيّنا/);
  assert.match(screen, /accessibilityRole="header"/);
  assert.match(screen, /maxWidth: 560/);
  assert.match(screen, /paddingHorizontal: 16/);
  assert.match(screen, /borderRadius: 18/);
  assert.match(screen, /OASIS\.colors\.line/);
  assert.match(screen, /paddingBottom: bottomNavInset \+ 12/);
});

test('each field is labeled and uses a practical maximum length', () => {
  for (const label of ['الاسم', 'البريد الإلكتروني، اختياري', 'موضوع الرسالة', 'نص الرسالة']) {
    assert.ok(screen.includes('accessibilityLabel="' + label + '"'), label);
  }
  assert.match(screen, /maxLength=\\{80\\}/);
  assert.match(screen, /maxLength=\\{254\\}/);
  assert.match(screen, /maxLength=\\{120\\}/);
  assert.match(screen, /autoCapitalize="none"/);
  assert.match(screen, /autoCorrect={false}/);
});

test('message field provides multiline guidance, limit, and live counter', () => {
  assert.match(screen, /const MESSAGE_LIMIT = 2000/);
  assert.match(screen, /multiline/);
  assert.match(screen, /maxLength=\\{MESSAGE_LIMIT\\}/);
  assert.match(screen, /accessibilityLiveRegion="polite"/);
  assert.match(screen, /message\.length} \/ \{MESSAGE_LIMIT\}/);
  assert.match(screen, /minHeight: 120/);
});

test('submit action is touch-sized and exposes its busy state', () => {
  assert.match(screen, /minHeight: 48/);
  assert.match(screen, /oasisKind="action"/);
  assert.match(screen, /oasisVariant="primary"/);
  assert.match(screen, /accessibilityState={{ disabled: sending, busy: sending }}/);
  assert.match(screen, /disabled={sending}/);
  assert.match(screen, /جارٍ الإرسال/);
});

test('contact form keeps the support ticket send path and user feedback', () => {
  assert.match(screen, /from\('support_tickets'\)\.insert/);
  assert.match(screen, /Alert\.alert\('تم الإرسال'/);
  assert.match(screen, /Alert\.alert\('تعذّر الإرسال'/);
});

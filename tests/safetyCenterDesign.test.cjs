'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const screen = fs.readFileSync(path.join(__dirname, '../app/safety-center.tsx'), 'utf8');

test('safety center content is centered, capped and inset-aware', () => {
  assert.match(screen, /content: \{ width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 16, gap: 15 \}/);
  assert.match(screen, /paddingBottom: bottomNavInset \+ 32/);
});

test('hero, quick actions and safety tools use consistent touch and card rhythm', () => {
  assert.match(screen, /heroButton: \{[^}]*minHeight: 48/);
  assert.match(screen, /quickCard: \{ flex: 1, minWidth: 0, minHeight: 136[^}]*borderRadius: 20/);
  assert.match(screen, /inlineAction: \{[^}]*minHeight: 44/);
  assert.match(screen, /policyRow: \{[^}]*minHeight: 82[^}]*borderRadius: 18/);
  assert.match(screen, /contactRow: \{[^}]*minHeight: 48/);
});

test('interactive safety cards and actions expose accessible names and state', () => {
  assert.match(screen, /accessibilityRole="button" accessibilityLabel="إرسال بلاغ جديد"/);
  assert.match(screen, /accessibilityLabel="الإبلاغ عن إساءة: محتوى أو حساب أو سلوك"/);
  assert.match(screen, /accessibilityState=\{\{ expanded: expanded === index \}\}/);
  assert.match(screen, /accessibilityLabel=\{item\.title \+ '\. ' \+ item\.desc\}/);
  assert.match(screen, /accessibilityRole="header"/);
});

test('non-hero surfaces use theme-aware semantic OASIS colors', () => {
  for (const token of [
    'OASIS.colors.primary',
    'OASIS.colors.info',
    'OASIS.colors.gold',
    'OASIS.colors.surface',
    'OASIS.colors.background',
    'OASIS.colors.dangerSoft',
    'OASIS.colors.warningSoft',
  ]) assert.ok(screen.includes(token), token);
  assert.doesNotMatch(screen, /const GREEN|#0F766E|#2563EB|#7C3AED|#FFF7F7/);
});

test('emergency warning is visible, region-aware and keeps existing call target', () => {
  assert.match(screen, /emergencyButton: \{[^}]*minHeight: 50/);
  assert.match(screen, /disclaimerSurface: \{ backgroundColor: OASIS\.colors\.warningSoft/);
  assert.match(screen, /الرقم الظاهر 911 قد لا يكون مناسبًا لكل منطقة/);
  assert.ok(screen.includes("open('tel:911')"));
});

test('the design-only change preserves the page destinations and contact links', () => {
  for (const route of [
    "router.push('/report')",
    "router.push('/support')",
    "pathname: '/profile'",
    'https://appksatest.vercel.app/privacy',
    'mailto:support@hayna.app',
  ]) assert.ok(screen.includes(route), route);
});

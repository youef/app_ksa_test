'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const screen = fs.readFileSync(path.join(__dirname, '../app/about.tsx'), 'utf8');

test('about screen uses theme-aware surfaces and shared OASIS tokens', () => {
  assert.match(screen, /useTheme\(\)/);
  for (const token of ['colors.background', 'colors.surface', 'colors.primary', 'colors.line', 'colors.muted']) {
    assert.ok(screen.includes(token), `expected theme token ${token}`);
  }
  assert.match(screen, /oasisSurface="card"/);
  assert.match(screen, /backgroundColor: colors\.live/);
});

test('about content is responsive and preserves safe-area and bottom navigation space', () => {
  assert.match(screen, /maxWidth: 760/);
  assert.match(screen, /paddingHorizontal: 16/);
  assert.match(screen, /paddingBottom: bottomNavInset \+ 24/);
  assert.match(screen, /<ScrollView/);
  assert.match(screen, /flexWrap: 'wrap'/);
});

test('section headings and decorative artwork have accessible semantics', () => {
  assert.match(screen, /accessibilityRole="header"/);
  assert.match(screen, /accessibilityElementsHidden/);
  assert.match(screen, /importantForAccessibility="no-hide-descendants"/);
  for (const label of ['مشاركة منصة حيّنا', 'تواصل عبر واتساب', 'اتصال بالمطور', 'مراسلة المطور بالبريد', 'مشاركة حيّنا']) {
    assert.ok(screen.includes(`accessibilityLabel="${label}"`), label);
  }
});

test('features, hero and contact actions use comfortable dimensions', () => {
  assert.match(screen, /width: 64, height: 64/);
  assert.match(screen, /width: 44, minWidth: 44, minHeight: 44/);
  assert.match(screen, /minHeight: 52/);
  assert.match(screen, /minHeight: 48/);
  assert.match(screen, /borderRadius: OASIS\.radius\.card \+ 4/);
});

test('email, call, WhatsApp and share failures have visible recovery feedback', () => {
  assert.match(screen, /تعذّر فتح واتساب/);
  assert.match(screen, /تعذّر بدء الاتصال/);
  assert.match(screen, /تعذّر فتح البريد/);
  assert.match(screen, /تعذّرت المشاركة/);
  assert.match(screen, /https:\/\/appksatest\.vercel\.app/);
});

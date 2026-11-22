'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const screen = fs.readFileSync(path.join(__dirname, '../app/report.tsx'), 'utf8');

test('report form establishes a calm, responsive hierarchy and respects the bottom dock', () => {
  assert.match(screen, /ساعدنا نحافظ على حيّنا/);
  assert.match(screen, /accessibilityRole="header"/);
  assert.match(screen, /maxWidth: 760/);
  assert.match(screen, /borderRadius: 22/);
  assert.match(screen, /useBottomNavInset\\(24\\)/);
  assert.match(screen, /paddingBottom: bottomNavInset/);
  assert.match(screen, /keyboardDismissMode="on-drag"/);
});

test('report reasons are accessible radio choices with comfortable touch targets', () => {
  assert.match(screen, /accessibilityRole="radio"/);
  assert.match(screen, /accessibilityState=\\{\\{ checked: selected \\}\\}/);
  assert.match(screen, /minHeight: 56/);
  assert.match(screen, /reasonOptionWide/);
  assert.match(screen, /accessibilityHint="اختر هذا السبب لتوضيح طبيعة البلاغ"/);
});

test('optional details field is labeled and spacious for multiline input', () => {
  assert.match(screen, /accessibilityLabel="تفاصيل إضافية للبلاغ"/);
  assert.match(screen, /accessibilityHint="حقل اختياري متعدد الأسطر"/);
  assert.match(screen, /multiline/);
  assert.match(screen, /minHeight: 136/);
  assert.match(screen, /textAlignVertical="top"/);
});

test('submit action announces its busy state and renders an inline recoverable error', () => {
  assert.match(screen, /minHeight: 52/);
  assert.match(screen, /accessibilityState=\\{\\{ disabled: submitting, busy: submitting \\}\\}/);
  assert.match(screen, /disabled=\\{submitting\\}/);
  assert.match(screen, /accessibilityLiveRegion="assertive"/);
  assert.match(screen, /submitError/);
  assert.match(screen, /finally\\s*\\{\\s*setSubmitting\\(false\\);\\s*\\}/);
});

test('private report history has loading, retry, signed-out, empty and populated states', () => {
  assert.match(screen, /reportsLoading/);
  assert.match(screen, /reportsError/);
  assert.match(screen, /historySignedIn === false/);
  assert.match(screen, /myReports\\.length === 0/);
  assert.match(screen, /onPress=\\{\\(\\) => void loadMyReports\\(\\)\\}/);
  assert.match(screen, /\\.limit\\(6\\)/);
});

test('report submission keeps the existing reports table and payload contract', () => {
  assert.match(screen, /from\\('reports'\\)\\.insert/);
  assert.match(screen, /reporter_id: userData\\.user\\.id/);
  assert.match(screen, /target_type: type \\|\\| 'unknown'/);
  assert.match(screen, /target_id: id/);
  assert.match(screen, /reason: fullReason/);
  assert.match(screen, /router\\.replace\\('\\/auth'\\)/);
  assert.match(screen, /router\\.back\\(\\)/);
});

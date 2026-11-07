'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../app/notifications.tsx'), 'utf8');

test('notification filters announce selected state and count', () => {
  assert.match(source, /accessibilityLabel=\{\x60\$\{tab.label\}، \$\{tab.count\} إشعار\x60\}/);
  assert.match(source, /accessibilityState=\{\{ selected: onlyUnread \}\}/);
});

test('notification feed supports refreshing and empty filter reset', () => {
  assert.match(source, /refreshControl=\{<RefreshControl refreshing=\{refreshing\}/);
  assert.match(source, /accessibilityLabel="إزالة تصفية الإشعارات"/);
  assert.match(source, /setOnlyUnread\(false\); setActiveTab\('all'\)/);
});

test('settings and notification actions remain accessible', () => {
  assert.match(source, /onRequestClose=\{\(\) => setSettingsOpen\(false\)\}/);
  assert.match(source, /accessibilityLabel="إغلاق إعدادات التنبيهات"/);
  assert.match(source, /accessibilityLabel="مسح جميع الإشعارات"/);
  assert.match(source, /accessibilityLabel=\{\x60\$\{isRead \? 'مقروء' : 'غير مقروء'\}/);
});

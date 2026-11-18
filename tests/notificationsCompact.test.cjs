'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../app/notifications.tsx'), 'utf8');

test('notification cards render compact content above actions and preserve navigation', () => {
  const body = source.indexOf('<View style={styles.cardBodyRow}>');
  const footer = source.indexOf('<View style={styles.cardFooterRow}>');
  assert.ok(body > 0 && footer > body, 'Main content precedes compact actions footer');
  assert.match(source, /styles\.notifCardUnread/);
  assert.match(source, /numberOfLines=\{3\} style=\{\[styles\.cardBody/);
  assert.match(source, /accessibilityLabel="حذف الإشعار"/);
  assert.match(source, /accessibilityLabel=\{isRead \? 'تحديد الإشعار كغير مقروء'/);
  assert.match(source, /handleNotificationPress\(item\)/);
  assert.match(source, /pathname: '\/user'/);
});

test('notification tab counts and feed use the same category definition', () => {
  assert.match(source, /function notificationMatchesCategory/);
  assert.match(source, /notificationMatchesCategory\(n, activeTab\)/);
  for (const key of ['all', 'emergency', 'answers', 'community', 'stories']) {
    assert.ok(source.includes(`countForCategory('${key}')`), `Missing category count: ${key}`);
  }
  assert.match(source, /type !== 'message' && item\.target_type !== 'conversation'/);
});

test('inbox actions preserve confirmation on bulk delete and allow unread filtering', () => {
  assert.match(source, /accessibilityState=\{\{ selected: onlyUnread \}\}/);
  assert.match(source, /onPress=\{confirmClearAll\}/);
  assert.match(source, /Alert\.alert\('مسح جميع الإشعارات'/);
  assert.match(source, /onPress=\{\(\) => void markAllAsRead\(\)\}/);
});

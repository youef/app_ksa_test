'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('the home feed and announcements use the entire usable horizontal viewport', () => {
  const home = read('app/home.tsx');
  const banners = read('components/home/CommunityShortcuts.tsx');
  assert.match(home, /feed: \{ width: '100%', marginTop: 0, paddingHorizontal: 0/);
  assert.match(home, /Math\.max\(insets\.left, insets\.right\)/);
  assert.doesNotMatch(banners, /maxWidth: 820/);
  assert.match(banners, /paddingHorizontal: 0/);
});

test('the rounded dock is more transparent and lower while retaining safe clearance', () => {
  const nav = read('components/BottomNav.tsx');
  assert.match(nav, /borderTopLeftRadius: 32/);
  assert.match(nav, /paddingBottom: safeBottom/);
  assert.match(nav, /getBottomDockInset\(insets\.bottom\)/);
  assert.match(nav, /rgba\(16,32,27,\.25\)/);
  assert.match(nav, /<BlurView intensity=\{55\}/);
});

test('first-run permission prompts require user gesture and are keyed per user', () => {
  const onboarding = read('components/home/FirstRunPermissions.tsx');
  const shell = read('app/_layout.tsx');
  assert.match(onboarding, /AsyncStorage\.getItem\(INTRO_KEY \+ userId\)/);
  assert.match(onboarding, /onPress=\{\(\) => void enableLocation\(\)\}/);
  assert.match(onboarding, /onPress=\{\(\) => void enableNotifications\(\)\}/);
  assert.match(onboarding, /getCurrentDeviceLocation\(\)/);
  assert.match(onboarding, /registerPushToken\(\)/);
  assert.match(shell, /refreshGrantedPushToken/);
  assert.doesNotMatch(shell, /void registerPushToken/);
});

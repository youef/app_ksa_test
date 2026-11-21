'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const screen = fs.readFileSync(path.join(__dirname, '../app/districts.tsx'), 'utf8');

test('district search normalizes Arabic labels and query with the shared location helper', () => {
  assert.ok(screen.includes('normalizeSaudiLocationName(search)'));
  assert.ok(screen.includes('normalizeSaudiLocationName(d.name).includes(normalizedSearch)'));
  assert.ok(screen.includes('const normalizedSearch = useMemo'));
});

test('search is labeled, announces results and has a 44px clear control', () => {
  assert.ok(screen.includes('accessibilityLabel="البحث عن حي"'));
  assert.ok(screen.includes('accessibilityLiveRegion="polite"'));
  assert.ok(screen.includes("toLocaleString('ar-SA')"));
  assert.ok(screen.includes('accessibilityLabel="مسح البحث"'));
  assert.ok(screen.includes('minWidth: 44'));
  assert.ok(screen.includes('minHeight: 44'));
});

test('empty results have distinct copy and a contextual recovery action', () => {
  assert.ok(screen.includes('districts.length === 0'));
  assert.ok(screen.includes('لا توجد أحياء مطابقة'));
  assert.ok(screen.includes('setSearch(\'\')'));
  assert.ok(screen.includes('router.replace({ pathname: \'/cities\''));
});

test('district cards and icon surfaces meet touch and responsive layout targets', () => {
  assert.ok(screen.includes('minHeight: 76'));
  assert.ok(screen.includes('borderRadius: 18'));
  assert.ok(screen.includes('width: 44'));
  assert.ok(screen.includes('height: 44'));
  assert.ok(screen.includes('maxWidth: 760'));
  assert.ok(screen.includes('paddingBottom: bottomNavInset'));
  assert.ok(!screen.includes('height: 100'));
});

test('selection errors preserve context and offer a retry', () => {
  assert.ok(screen.includes('تعذر حفظ اختيارك'));
  assert.ok(screen.includes('onPress: () => selectDistrict(districtName)'));
  assert.ok(!screen.includes("catch (e) {\n      router.replace('/home');"));
});

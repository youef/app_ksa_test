'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const screen = fs.readFileSync(path.join(__dirname, '../app/map.tsx'), 'utf8');

test('native map floating surfaces respect the app header and device safe areas', () => {
  assert.match(screen, /useSafeAreaInsets\(\)/);
  assert.match(screen, /useWindowDimensions\(\)/);
  assert.match(screen, /useAppHeaderHeight\(\)/);
  assert.match(screen, /top: appHeaderHeight \+ 10/);
  assert.match(screen, /bottom: bottomInset \+ 62/);
  assert.match(screen, /bottom: bottomInset \+ 10/);
  assert.match(screen, /maxHeight: placesSheetHeight/);
  assert.match(screen, /maxHeight: Math\.max\(90, placesSheetHeight - 54\)/);
  assert.match(screen, /maxWidth: viewportWidth >= 768 \? 560 : undefined/);
});

test('native map detail panels replace the result sheet instead of overlapping it', () => {
  assert.match(screen, /detailPanelBottom = bottomInset \+ 66/);
  assert.match(screen, /!selectedPlace && !selected \? <View style=\{\[styles\.placesSheet/);
  assert.match(screen, /maxWidth: viewportWidth >= 768 \? 520 : undefined/);
});

test('map search and filters expose keyboard and selection accessibility', () => {
  assert.match(screen, /onSubmitEditing=\{\(\) => void runPlaceSearch\(placeCategory\)\}/);
  assert.match(screen, /returnKeyType="search"/);
  assert.match(screen, /accessibilityLabel="البحث عن نشاط أو مكان في الحي"/);
  assert.match(screen, /accessibilityState=\{\{ selected: active \}\}/);
  assert.match(screen, /hitSlop=\{\{ top: 6, bottom: 6, left: 4, right: 4 \}\}/);
  assert.match(screen, /minHeight: 44/);
});

test('map loading, failure, retry, and contextual empty states are explicit', () => {
  assert.match(screen, /pinsError/);
  assert.match(screen, /جارٍ تحميل أنشطة الحي/);
  assert.match(screen, /إعادة تحميل أنشطة الحي/);
  assert.match(screen, /emptyPinState/);
  assert.match(screen, /لا توجد أنشطة منشورة في هذه المدينة بعد/);
  assert.match(screen, /placesError/);
  assert.match(screen, /إعادة تحميل الأماكن القريبة/);
  assert.match(screen, /اختر مدينتك أو حدّد موقعك لعرض الأماكن القريبة/);
  assert.match(screen, /لا توجد أماكن مطابقة حاليًا/);
  assert.doesNotMatch(screen, /فعّل الموقع لعرض المحلات القريبة/);
});

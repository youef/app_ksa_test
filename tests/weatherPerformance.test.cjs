'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const weather = fs.readFileSync(path.join(__dirname, '../app/weather.tsx'), 'utf8');

test('weather shows current conditions before search and optional sections', () => {
  assert.ok(weather.indexOf('style={[styles.card, styles.weatherHeroCard]}') < weather.indexOf('{/* City search */}'));
  assert.ok(weather.indexOf('styles.snapshotGrid') < weather.indexOf('styles.quickLinks'));
  assert.match(weather, /accessibilityState=\{\{ expanded: cityPickerOpen \}\}/);
  assert.match(weather, /accessibilityState=\{\{ expanded: locationDetailsOpen \}\}/);
  assert.match(weather, /weather && detailsExpanded && \(/);
  assert.match(weather, /showAllDays \? 16 : 7/);
});

test('weather caches cities while keeping manual refresh fresh', () => {
  assert.match(weather, /WEATHER_CACHE_TTL_MS = 10 \* 60 \* 1000/);
  assert.match(weather, /weatherCache\.get\(key\)/);
  assert.match(weather, /if \(!force && cached && Date\.now\(\) - cached\.fetchedAt < WEATHER_CACHE_TTL_MS\)/);
  assert.match(weather, /void airPromise\.then\(air =>/);
  assert.match(weather, /const placePromise = resolvePlace\(latitude, longitude\)/);
  assert.match(weather, /\}, true\);/);
  assert.match(weather, /setInterval\(\(\) => setNow\(new Date\(\)\), 60 \* 1000\)/);
});

test('weather separates estimated notices from official warnings', () => {
  assert.match(weather, /topAlert\.id === 'ok'/);
  assert.match(weather, /تقدير آلي وليس بديلًا عن الإنذارات الرسمية/);
  assert.match(weather, /ncm\.gov\.sa\/en\/early-warning/);
  assert.match(weather, /accessibilityRole="button" accessibilityLabel="فتح إنذارات المركز الوطني للأرصاد"/);
});

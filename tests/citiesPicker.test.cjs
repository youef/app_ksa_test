const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const helperPath = path.join(__dirname, '../lib/cityPickerPresentation.ts');
const helperModule = new Module(helperPath);
const source = fs.readFileSync(helperPath, 'utf8');
helperModule._compile(require('typescript').transpileModule(source, {
  compilerOptions: { module: require('typescript').ModuleKind.CommonJS, target: require('typescript').ScriptTarget.ES2022 },
}).outputText, helperPath);
const { filterCitiesByQuery } = helperModule.exports;

function normalizeArabicLocation(value) {
  return value.trim()
    .replace(/^(مدينة|حي|منطقة)\\s+/u, '')
    .replace(/[\\u064B-\\u065F\\u0670\\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\\s+/g, ' ')
    .toLocaleLowerCase('ar');
}

test('city picker search normalizes Saudi Arabic spelling variations', () => {
  const cities = [
    { name: 'الرياض', id: 'riyadh' },
    { name: 'جدة', id: 'jeddah' },
    { name: 'أبها', id: 'abha' },
    { name: 'المدينة المنورة', id: 'madinah' },
  ];
  assert.deepEqual(filterCitiesByQuery(cities, 'مدينة الرياض', normalizeArabicLocation), [cities[0]]);
  assert.deepEqual(filterCitiesByQuery(cities, 'جَدَّة', normalizeArabicLocation), [cities[1]]);
  assert.deepEqual(filterCitiesByQuery(cities, 'ابها', normalizeArabicLocation), [cities[2]]);
  assert.deepEqual(filterCitiesByQuery(cities, 'المدينه', normalizeArabicLocation), [cities[3]]);
});

test('blank search preserves all cities and unmatched search is empty', () => {
  const cities = [{ name: 'الرياض' }, { name: 'جدة' }];
  assert.equal(filterCitiesByQuery(cities, '   ', normalizeArabicLocation), cities);
  assert.deepEqual(filterCitiesByQuery(cities, 'مدينة غير موجودة', normalizeArabicLocation), []);
});

test('city picker keeps accessible clear/reset and empty state affordances', () => {
  const screen = fs.readFileSync(path.join(__dirname, '../app/cities.tsx'), 'utf8');
  assert.ok(screen.includes('accessibilityLabel="البحث عن مدينة أو محافظة"'));
  assert.ok(screen.includes('accessibilityLabel="مسح البحث"'));
  assert.ok(screen.includes('لم نعثر على مدينة بهذا الاسم'));
  assert.ok(screen.includes('accessibilityLabel={'));
  assert.ok(screen.includes('styles.emptyState'));
});

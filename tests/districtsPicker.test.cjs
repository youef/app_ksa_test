const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

const helperPath = path.join(__dirname, '../lib/districtPickerPresentation.ts');
const helperModule = new Module(helperPath);
const source = fs.readFileSync(helperPath, 'utf8');
helperModule._compile(require('typescript').transpileModule(source, {
  compilerOptions: {
    module: require('typescript').ModuleKind.CommonJS,
    target: require('typescript').ScriptTarget.ES2022,
  },
}).outputText, helperPath);
const { filterDistrictsByQuery } = helperModule.exports;

function normalizeArabicLocation(value) {
  return value.trim()
    .replace(/^(مدينة|حي|منطقة)\s+/u, '')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('ar');
}

test('district search matches Arabic diacritics, prefixes, and tatweel', () => {
  const districts = [
    { name: 'حي العليا', id: 'olaya' },
    { name: 'حي الياسمين', id: 'yasmin' },
    { name: 'حي جَدَّة', id: 'jeddah' },
    { name: 'حي الشفا', id: 'shifa' },
  ];
  assert.deepEqual(filterDistrictsByQuery(districts, 'العلـيا', normalizeArabicLocation), [districts[0]]);
  assert.deepEqual(filterDistrictsByQuery(districts, 'حي جده', normalizeArabicLocation), [districts[2]]);
  assert.deepEqual(filterDistrictsByQuery(districts, 'الشَّفا', normalizeArabicLocation), [districts[3]]);
});

test('blank district query keeps the original list and unmatched query returns none', () => {
  const districts = [{ name: 'حي العليا' }, { name: 'حي الياسمين' }];
  assert.equal(filterDistrictsByQuery(districts, '   ', normalizeArabicLocation), districts);
  assert.deepEqual(filterDistrictsByQuery(districts, 'حي غير موجود', normalizeArabicLocation), []);
});

test('district picker exposes accessible recovery and responsive card targets', () => {
  const screen = fs.readFileSync(path.join(__dirname, '../app/districts.tsx'), 'utf8');
  for (const fragment of [
    'filterDistrictsByQuery',
    'normalizeSaudiLocationName',
    'accessibilityLabel="البحث عن حي"',
    'accessibilityLabel="مسح البحث"',
    'accessibilityLiveRegion="polite"',
    'لم نعثر على حي بهذا الاسم',
    'styles.emptyState',
    'minHeight: 76',
    'width: 44',
    'maxWidth: 720',
    'borderRadius: 18',
    'keyboardShouldPersistTaps="handled"',
    'paddingBottom: bottomNavInset',
    'ActivityIndicator',
  ]) assert.ok(screen.includes(fragment), fragment);
  assert.ok(!screen.includes('height: 100'));
});

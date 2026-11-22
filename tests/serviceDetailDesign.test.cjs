const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../app/service.tsx'), 'utf8');

test('service detail respects the bottom safe area and leaves scroll clearance', () => {
  assert.match(source, /useSafeAreaInsets/);
  assert.match(source, /safeAreaInsets\\.bottom \\+ 92/);
  assert.match(source, /paddingBottom: Math\\.max\\(12, safeAreaInsets\\.bottom \\+ 12\\)/);
});

test('share and report header actions have 44-point hit areas', () => {
  const hitAreas = source.match(/width: 44,\\s*height: 44,\\s*borderRadius: 14,\\s*backgroundColor: OASIS\\.colors\\.soft,/g) || [];
  assert.equal(hitAreas.length, 2);
});

test('gallery and related cards expose labels to assistive technology', () => {
  assert.ok(source.includes('accessibilityLabel={`عرض الصورة ${idx + 1} من ${images.length}`}'));
  assert.ok(source.includes('accessibilityLabel={`الصورة ${activeImage + 1} من ${images.length}`}'));
  assert.match(source, /accessibilityElementsHidden/);
  assert.match(source, /accessibilityHint="فتح تفاصيل العرض"/);
});

test('primary surfaces use the refined radius rhythm', () => {
  assert.match(source, /galleryCard:\\s*\\{\\s*borderRadius: 20,/);
  assert.match(source, /infoCard:\\s*\\{\\s*backgroundColor: OASIS\\.colors\\.surface,\\s*borderRadius: 18,\\s*padding: 20,/);
  assert.match(source, /sectionCard:\\s*\\{\\s*backgroundColor: OASIS\\.colors\\.surface,\\s*borderRadius: 18,\\s*padding: 16,/);
  assert.match(source, /relatedCard:\\s*\\{\\s*width: 160,/);
  assert.match(source, /relatedImgBox: \\{ width: '100%', height: 112,/);
});

test('inline contact actions retain accessible minimum touch height', () => {
  assert.match(source, /inlineMessageBtn: \\{[^}]*minHeight: 48/);
  assert.match(source, /inlineWhatsAppBtn: \\{[^}]*minHeight: 48/);
  assert.match(source, /inlinePhoneBtn: \\{[^}]*minHeight: 48/);
  assert.match(source, /sellerActionBtn:\\s*\\{[^}]*minHeight: 44/);
  assert.match(source, /ownerDeleteBtn:\\s*\\{[^}]*minHeight: 44/);
  assert.match(source, /ownerEditBtn:\\s*\\{[^}]*minHeight: 44/);
});

test('edit sheet has an internal scroll region and accessible field labels', () => {
  assert.match(source, /<ScrollView style=\\{styles\\.editModalScroll\\} contentContainerStyle=\\{styles\\.editModalBody\\} keyboardShouldPersistTaps="handled">/);
  assert.match(source, /editModalScroll: \\{ flexShrink: 1 \\}/);
  assert.match(source, /accessibilityLabel="اسم العرض"/);
  assert.match(source, /accessibilityLabel="وصف العرض، اختياري"/);
  assert.match(source, /editModalInput:\\s*\\{[^}]*minHeight: 48/);
  assert.match(source, /editModalTextArea: \\{ minHeight: 128/);
  assert.match(source, /editModalCloseBtn:\\s*\\{\\s*width: 44, height: 44/);
});

test('service contact, edit and delete handlers remain in place', () => {
  assert.match(source, /async function openWhatsApp\\(\\)/);
  assert.match(source, /async function contactProvider\\(\\)/);
  assert.match(source, /async function handleSaveEdit\\(\\)/);
  assert.match(source, /async function remove\\(\\)/);
});

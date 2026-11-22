const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../app/service.tsx'), 'utf8');

test('service detail respects safe-area and scroll clearance', () => {
  assert.ok(source.includes('const safeAreaInsets = useSafeAreaInsets();'));
  assert.ok(source.includes('safeAreaInsets.bottom + 92'));
  assert.ok(source.includes('paddingBottom: Math.max(12, safeAreaInsets.bottom + 12)'));
});

test('header share and report controls have 44-point hit areas', () => {
  const hitAreas = source.match(/width: 44,\s*height: 44,\s*borderRadius: 14,\s*backgroundColor: OASIS\.colors\.soft,/g) || [];
  assert.equal(hitAreas.length, 2);
});

test('gallery and related offers are labeled for screen readers', () => {
  assert.ok(source.includes('accessibilityLabel={`عرض الصورة \${idx + 1} من \${images.length}`}'));
  assert.ok(source.includes('accessibilityLabel={`الصورة \${activeImage + 1} من \${images.length}`}'));
  assert.ok(source.includes('accessibilityElementsHidden'));
  assert.ok(source.includes('accessibilityHint="فتح تفاصيل العرض"'));
});

test('main detail cards follow the updated spacing and radius rhythm', () => {
  assert.ok(source.includes('galleryCard: {\n    borderRadius: 20,'));
  assert.ok(source.includes('infoCard: {\n    backgroundColor: OASIS.colors.surface,\n    borderRadius: 18,\n    padding: 20,'));
  assert.ok(source.includes('sectionCard: {\n    backgroundColor: OASIS.colors.surface,\n    borderRadius: 18,\n    padding: 16,'));
  assert.ok(source.includes('relatedCard: {\n    width: 160,'));
  assert.ok(source.includes("relatedImgBox: { width: '100%', height: 112,"));
});

test('contact and owner controls preserve larger touch targets', () => {
  assert.match(source, /inlineMessageBtn: \{[^}]*minHeight: 48/);
  assert.match(source, /inlineWhatsAppBtn: \{[^}]*minHeight: 48/);
  assert.match(source, /inlinePhoneBtn: \{[^}]*minHeight: 48/);
  assert.match(source, /sellerActionBtn: \{[^}]*minHeight: 44/);
  assert.match(source, /ownerDeleteBtn: \{[^}]*minHeight: 44/);
  assert.match(source, /ownerEditBtn: \{[^}]*minHeight: 44/);
});

test('edit sheet is scrollable and fields have accessible labels', () => {
  assert.ok(source.includes('<ScrollView style={styles.editModalScroll} contentContainerStyle={styles.editModalBody} keyboardShouldPersistTaps="handled">'));
  assert.ok(source.includes('editModalScroll: { flexShrink: 1 }'));
  assert.ok(source.includes('accessibilityLabel="اسم العرض"'));
  assert.ok(source.includes('accessibilityLabel="وصف العرض، اختياري"'));
  assert.match(source, /editModalInput: \{[^}]*minHeight: 48/);
  assert.ok(source.includes('editModalTextArea: { minHeight: 128'));
  assert.match(source, /editModalCloseBtn: \{\s*width: 44, height: 44/);
});

test('contact, edit and delete action handlers are preserved', () => {
  assert.match(source, /async function openWhatsApp\(\)/);
  assert.match(source, /async function contactProvider\(\)/);
  assert.match(source, /async function handleSaveEdit\(\)/);
  assert.match(source, /async function remove\(\)/);
});

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

test('share and report header controls have 44-point hit areas', () => {
  const headerActions = source.split('<HeaderAction').slice(1).map((block) => block.split('</HeaderAction>')[0]);
  const largeTargets = headerActions.filter((block) => block.includes('width: 44,') && block.includes('height: 44,'));
  assert.equal(largeTargets.length, 2);
});

test('gallery and related offers are labeled for screen readers', () => {
  assert.ok(source.includes('accessibilityLabel={`عرض الصورة ${idx + 1} من ${images.length}`}'));
  assert.ok(source.includes('accessibilityLabel={`الصورة ${activeImage + 1} من ${images.length}`}'));
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
  assert.ok(source.includes('inlineMessageBtn: { flexGrow: 1, flexBasis: 140, minHeight: 48'));
  assert.ok(source.includes('inlineWhatsAppBtn: { flexGrow: 1, flexBasis: 90, minHeight: 48'));
  assert.ok(source.includes('inlinePhoneBtn: { flexGrow: 1, flexBasis: 90, minHeight: 48'));
  assert.ok(source.includes('sellerActionBtn: {\n    flexDirection: \'row-reverse\',\n    alignItems: \'center\',\n    minHeight: 44'));
  assert.ok(source.includes('ownerDeleteBtn: {\n    flexDirection: \'row-reverse\',\n    alignItems: \'center\',\n    justifyContent: \'center\',\n    minHeight: 44'));
  assert.ok(source.includes('ownerEditBtn: {\n    flex: 1,\n    minHeight: 44'));
});

test('edit sheet has an internal scroll region and accessible field labels', () => {
  assert.ok(source.includes('<ScrollView style={styles.editModalScroll} contentContainerStyle={styles.editModalBody} keyboardShouldPersistTaps="handled">'));
  assert.ok(source.includes('editModalScroll: { flexShrink: 1 }'));
  assert.ok(source.includes('accessibilityLabel="اسم العرض"'));
  assert.ok(source.includes('accessibilityLabel="وصف العرض، اختياري"'));
  assert.ok(source.includes('editModalInput: {\n    backgroundColor: OASIS.colors.background,\n    minHeight: 48'));
  assert.ok(source.includes('editModalTextArea: { minHeight: 128'));
  assert.ok(source.includes('editModalCloseBtn: {\n    width: 44, height: 44'));
});

test('contact, edit and delete action handlers are preserved', () => {
  assert.ok(source.includes('async function openWhatsApp()'));
  assert.ok(source.includes('async function contactProvider()'));
  assert.ok(source.includes('async function handleSaveEdit()'));
  assert.ok(source.includes('async function remove()'));
});

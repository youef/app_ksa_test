const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.resolve(__dirname, '../components/profile/ProfileIdentityCard.tsx'), 'utf8');

test('account-type selector is a labelled RTL radio group', () => {
  assert.ok(source.includes('<View style={styles.typeGrid} accessibilityRole="radiogroup" accessibilityLabel="نوع الحساب" accessibilityHint="اختر الصفة التي تمثلك">'));
  assert.ok(source.includes("typeGrid: {\n    flexDirection: 'row-reverse',\n    flexWrap: 'wrap',"));
});

test('each type option uses radio semantics', () => {
  assert.ok(source.includes('accessibilityRole="radio"'));
});

test('selected account type is announced', () => {
  assert.ok(source.includes('accessibilityState={{ selected: active }}'));
});

test('options retain Arabic labels and provide selection guidance', () => {
  assert.match(source, /accessibilityLabel=\{[^}]*item\.label/);
  assert.ok(source.includes("accessibilityHint={active ? 'الصفة المختارة حاليًا' : 'اضغط لاختيار هذه الصفة'}"));
});

test('option targets are at least 48px and include hit slop', () => {
  assert.ok(source.includes('minHeight: 48'));
  assert.ok(source.includes('hitSlop={4}'));
});

test('icons are larger and selected option has stronger outline', () => {
  assert.ok(source.includes('width: 32,\n    height: 32,\n    borderRadius: 10'));
  assert.ok(source.includes("active && { backgroundColor: item.softColor, borderColor: item.color + '55', borderWidth: 2 },"));
});

test('RTL wrap, original callback, and motion-free behavior are preserved', () => {
  assert.ok(source.includes("flexDirection: 'row-reverse'"));
  assert.ok(source.includes("flexWrap: 'wrap'"));
  assert.ok(source.includes('onPress={() => onSelectType?.(type)}'));
  assert.ok(!source.includes('Animated.View'));
  assert.ok(!source.includes('useAnimatedStyle'));
});

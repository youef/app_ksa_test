const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.resolve(__dirname, '../components/profile/ProfileConnections.tsx'), 'utf8');

test('initial followers/following load renders four RTL-shaped skeleton rows', () => {
  assert.match(source, /loading && !people\.length \? \(/);
  assert.match(source, /Array\.from\(\{ length: 4 \}/);
  assert.ok(source.includes('skeletonAvatar'));
  assert.ok(source.includes('skeletonName'));
  assert.ok(source.includes('skeletonSubtitle'));
  assert.ok(source.includes("flexDirection: 'row-reverse'"));
});

test('the initial loading state is announced once with a context-aware Arabic label', () => {
  assert.ok(source.includes('accessibilityRole="progressbar"'));
  assert.ok(source.includes("accessibilityLabel={kind === 'followers' ? 'جارٍ تحميل المتابعين' : 'جارٍ تحميل الحسابات التي يتابعها'}"));
  assert.ok(source.includes('accessibilityState={{ busy: true }}'));
  assert.ok(source.includes('testID="profile-connections-skeleton"'));
});

test('decorative skeleton rows are hidden from assistive technology', () => {
  assert.ok(source.includes('accessibilityElementsHidden'));
  assert.ok(source.includes('importantForAccessibility="no-hide-descendants"'));
  assert.ok(source.includes('accessible={false}'));
});

test('the skeleton is static and pagination keeps its existing loading indicator', () => {
  assert.doesNotMatch(source, /Animated|Reanimated|useAnimatedStyle|shimmer/i);
  assert.match(source, /:\s*loading \? <ActivityIndicator/);
});

test('existing error, empty and load-more recovery paths remain available', () => {
  assert.ok(source.includes('تعذر التحميل. اضغط لإعادة المحاولة'));
  assert.ok(source.includes('لا توجد حسابات لعرضها حتى الآن'));
  assert.ok(source.includes('عرض المزيد'));
  assert.ok(source.includes('.range(page * 30, page * 30 + 29)'));
});

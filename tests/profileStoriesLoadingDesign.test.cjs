const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.resolve(__dirname, '../components/profile/ProfileStories.tsx'), 'utf8');

test('profile stories use a card-shaped skeleton instead of a lone spinner', () => {
  assert.match(source, /function ProfileStoriesLoadingState\(\)/);
  assert.match(source, /\{loading \? <ProfileStoriesLoadingState \/> : error \?/);
  assert.doesNotMatch(source, /ActivityIndicator/);
  assert.match(source, /Array\.from\(\{ length: 3 \}/);
  assert.match(source, /skeletonSummaryItem/);
  assert.match(source, /skeletonPreview/);
});

test('the loading state is announced once and decorative placeholders are hidden', () => {
  assert.match(source, /accessible\s+accessibilityRole="progressbar"/);
  assert.match(source, /accessibilityLabel="جارٍ تحميل اليوميات"/);
  assert.match(source, /accessibilityState=\{\{ busy: true \}\}/);
  assert.equal((source.match(/accessibilityElementsHidden/g) || []).length, 2);
  assert.equal((source.match(/importantForAccessibility="no-hide-descendants"/g) || []).length, 2);
});

test('skeleton previews preserve the RTL horizontal list and existing card dimensions', () => {
  assert.match(source, /style=\{\{ direction: 'rtl' \}\}[\s\S]*?horizontal[\s\S]*?contentContainerStyle=\{\[s\.list, s\.skeletonList, \{ direction: 'ltr' \}\]\}/);
  assert.match(source, /list: \{ flexDirection: 'row-reverse', gap: 12 \}/);
  assert.match(source, /item: \{ width: 152, gap: 8 \}/);
  assert.match(source, /skeletonPreview: \{ height: 190/);
});

test('the skeleton is static and does not introduce motion', () => {
  assert.doesNotMatch(source, /Animated\.|withRepeat|withTiming|shimmer/i);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.resolve(__dirname, '../components/profile/ProfileEditor.tsx'), 'utf8');

test('bio meter exposes a labelled accessible progress value', () => {
  assert.ok(source.includes('accessibilityRole="progressbar"'));
  assert.ok(source.includes('accessibilityLabel="مؤشر طول النبذة"'));
  assert.ok(source.includes('accessibilityValue={{ min: 0, max: field.max, now: bioProgress.count }}'));
  assert.ok(source.includes('bioProgress.nearLimit ? colors.warning : colors.primary'));
});

test('meter is RTL, compact and motion-free', () => {
  assert.ok(source.includes("bioTrack: { height: 4"));
  assert.ok(source.includes("flexDirection: 'row-reverse'"));
  assert.ok(source.includes('width: `${bioProgress.percent}%`'));
  assert.ok(!source.includes('Animated.View'));
});

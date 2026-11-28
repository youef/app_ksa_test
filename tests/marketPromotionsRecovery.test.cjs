const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync(require.resolve('../components/market/MarketPromotions.tsx'), 'utf8');

test('RPC failure is visible instead of being silently treated as no promotions', () => {
  assert.match(source, /if\s*\(response\.error\)\s*\{\s*setFailed\(true\);\s*return;/);
  assert.match(source, /تعذر تحميل العروض المميزة/);
});

test('retry control has a 44px touch target and accessible busy/disabled state', () => {
  assert.match(source, /accessibilityRole="button"/);
  assert.match(source, /accessibilityLabel="إعادة تحميل العروض المميزة"/);
  assert.match(source, /accessibilityState=\{\{ disabled: retrying, busy: retrying \}\}/);
  assert.match(source, /minHeight:\s*44/);
});

test('retry action invokes a manual load and exposes its pending label', () => {
  assert.match(source, /onPress=\{\(\) => void load\(true\)\}/);
  assert.match(source, /جاري إعادة المحاولة/);
  assert.match(source, /disabled=\{retrying\}/);
});

test('stale fetch results are ignored after location or request changes', () => {
  assert.match(source, /const requestSequence = useRef\(0\)/);
  assert.match(source, /if \(ticket !== requestSequence\.current\) return/);
  assert.match(source, /requestSequence\.current\+\+/);
});

test('keeps periodic refresh and cancels its timer on cleanup', () => {
  assert.match(source, /REFRESH_INTERVAL_MS = 60_000/);
  assert.match(source, /setInterval\(\(\) => void load\(\), REFRESH_INTERVAL_MS\)/);
  assert.match(source, /clearInterval\(timer\)/);
});

test('failed refresh keeps previously rendered promotions and success clears error state', () => {
  const failureBranch = source.match(/if \(response\.error\) \{[\s\S]*?return;\s*\}/);
  assert.ok(failureBranch, 'expected explicit RPC error branch');
  assert.doesNotMatch(failureBranch[0], /setRows\(/);
  assert.match(source, /setRows\(response\.data \|\| \[\]\);\s*setFailed\(false\)/);
});


test('first city-scoped load exposes a skeleton until the request settles', () => {
  assert.match(source, /const \[loading, setLoading\] = useState\(\(\) => Boolean\(city && !\/\^كل\|\^جميع\/\.test\(city\)\)\);/);
  assert.match(source, /const hasScopedCity = Boolean\(city && !\/\^كل\|\^جميع\/\.test\(city\)\);\s*setLoading\(hasScopedCity\);\s*if \(!hasScopedCity\) return;/);
  assert.match(source, /if \(ticket === requestSequence\.current\) \{\s*setLoading\(false\);/);
});

test('promotion skeleton is announced as a busy progress bar and hides decorative shapes', () => {
  assert.match(source, /accessibilityRole="progressbar"/);
  assert.match(source, /accessibilityLabel="جارٍ تحميل العروض المميزة"/);
  assert.match(source, /accessibilityState=\{\{ busy: true \}\}/);
  assert.match(source, /accessibilityElementsHidden importantForAccessibility="no-hide-descendants"/);
});

test('skeleton appears only before the first visible promotion and does not replace stale cards', () => {
  assert.match(source, /\{loading && !visible\.length \?/);
  assert.match(source, /\{visible\.map\(row => \(/);
  assert.match(source, /if \(!visible\.length && !failed && !loading\) return null;/);
});

test('loading skeleton is static and does not introduce shimmer or animation', () => {
  const skeleton = source.match(/\{loading && !visible\.length \? \([\s\S]*?\) : null\}/);
  assert.ok(skeleton, 'expected a dedicated first-load skeleton');
  assert.doesNotMatch(skeleton[0], /Animated|shimmer|withRepeat|animation/i);
});

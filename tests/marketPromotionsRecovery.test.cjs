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

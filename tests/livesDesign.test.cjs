const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../app/lives.tsx'), 'utf8');

test('live creation is easy to reach without repeating a header and hero CTA', () => {
  assert.equal(source.split("router.push('/live/create')").length - 1, 3, 'Search toolbar and two contextual empty states');
  assert.ok(source.includes('accessibilityLabel="إنشاء بث مباشر"'), 'The main creation action is labeled for screen readers');
  assert.ok(!source.includes('style={styles.heroCta}'), 'Do not duplicate creation inside the hero');
  assert.ok(!source.includes('<HeaderAction'), 'Avoid a second redundant creation button in the header');
});

test('every live tab has a visible name and an accessible selected state', () => {
  assert.ok(source.includes('accessibilityLabel={item.label}'));
  assert.ok(source.includes('accessibilityState={{ selected: active }}'));
  assert.ok(source.includes('<Text style={[styles.tabLabel, { color: active ?'));
  assert.ok(!source.includes('active ? <Text style={[styles.tabLabel'), 'Inactive labels must remain visible');
  assert.ok(source.includes('minHeight: 48'), 'Tab touch targets must remain accessible');
});

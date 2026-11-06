const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../app/lives.tsx'), 'utf8');
test('live directory exposes one broadcast creation action', () => {
  assert.equal((source.match(/router\.push\('\/live\/create'\)/g) || []).length, 2, 'Header action and empty-state action only');
  assert.ok(!source.includes('style={styles.heroCta}'), 'Do not duplicate create CTA in the hero');
});
test('icon-first tabs remain accessible by name', () => {
  assert.ok(source.includes('accessibilityLabel={item.label}'));
  assert.ok(source.includes('active ? <Text style={[styles.tabLabel, styles.tabLabelActive]}'));
  assert.ok(source.includes('minHeight: 48'));
});

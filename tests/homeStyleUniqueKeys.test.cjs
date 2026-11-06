const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('home StyleSheet declares each top-level style exactly once', () => {
  const source = fs.readFileSync(path.join(__dirname, '../components/home/homeStyles.ts'), 'utf8');
  const body = source.split('export const styles = StyleSheet.create({')[1];
  assert.ok(body, 'home StyleSheet must exist');
  const keys = [...body.matchAll(/^  ([A-Za-z][A-Za-z0-9]*):/gm)].map(m => m[1]);
  const repeated = keys.filter((key, index) => keys.indexOf(key) !== index);
  assert.deepEqual(repeated, [], 'duplicate style names override earlier styles and break TypeScript');
});

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workflowDirectory = path.join(__dirname, '..', '.github', 'workflows');

test('GitHub Actions workflow files contain no unresolved merge conflicts', () => {
  const files = fs.readdirSync(workflowDirectory).filter((name) => /\.ya?ml$/i.test(name));
  assert.ok(files.length > 0, 'Expected at least one GitHub Actions workflow');

  for (const name of files) {
    const source = fs.readFileSync(path.join(workflowDirectory, name), 'utf8');
    assert.doesNotMatch(
      source,
      /^(?:<{7}(?:\s|$)|={7}(?:\s|$)|>{7}(?:\s|$))/m,
      `Unresolved merge-conflict marker in ${name}`
    );
  }
});

test('manual Expo build workflow keeps separate Android and iOS jobs', () => {
  const source = fs.readFileSync(path.join(workflowDirectory, 'expo-build.yml'), 'utf8');
  assert.match(source, /^  workflow_dispatch:\s*$/m);
  assert.match(source, /^  android:\s*$/m);
  assert.match(source, /^  ios:\s*$/m);
  assert.match(source, /secrets\.EXPO_TOKEN/);
  assert.match(source, /eas-cli@latest build --platform android --profile preview --non-interactive --wait/);
  assert.match(source, /eas-cli@latest build --platform ios --profile testflight --non-interactive --wait/);
});

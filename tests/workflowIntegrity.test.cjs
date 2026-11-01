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

// Generated bundles are intentionally excluded; source, migrations, and CI files are checked.
const sourceRoots = ['app', 'components', 'lib', 'scripts', 'supabase', 'tests', '.github/workflows'];
const sourceFilePattern = /\.(?:[cm]?[jt]sx?|ya?ml|sql)$/i;
const ignoredDirectories = new Set(['node_modules', 'dist', 'build', '.expo', '.git', '.next']);

function walkSourceFiles(directory, output) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) walkSourceFiles(absolute, output);
    } else if (entry.isFile() && sourceFilePattern.test(entry.name)) {
      output.push(absolute);
    }
  }
}

test('application, migration, and workflow source contains no unresolved merge markers', () => {
  const files = [];
  for (const root of sourceRoots) walkSourceFiles(path.join(__dirname, '..', root), files);
  assert.ok(files.length > 0, 'Expected application source files');
  for (const filename of files) {
    const source = fs.readFileSync(filename, 'utf8');
    assert.doesNotMatch(
      source,
      /^(?:<{7}(?:\s|$)|={7}(?:\s|$)|>{7}(?:\s|$))/m,
      `Unresolved merge-conflict marker in ${path.relative(path.join(__dirname, '..'), filename)}`
    );
  }
});

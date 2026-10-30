'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const workflow = readFileSync(
  join(__dirname, '..', '.github', 'workflows', 'inquiry-discussion-checks.yml'),
  'utf8'
);

test('inquiry CI token is explicitly read-only', () => {
  assert.match(workflow, /^permissions:\r?\n  contents: read(?:\r?\n|$)/m);
  assert.doesNotMatch(workflow, /^  (?:contents|actions|checks|issues|pull-requests|deployments|packages|statuses): write\s*$/m);
});

test('both checkout steps pin a full action SHA and discard Git credentials', () => {
  const checkout = [...workflow.matchAll(
    /^        uses: actions\/checkout@([0-9a-f]{40})[^\n]*\r?\n        with:\r?\n          persist-credentials: false/gm
  )];
  assert.equal(checkout.length, 2);
});

test('both Node setup steps pin a full action SHA', () => {
  const setup = [...workflow.matchAll(/^        uses: actions\/setup-node@([0-9a-f]{40})/gm)];
  assert.equal(setup.length, 2);
});


const protectedWorkflows = [
  ['expo-build.yml', 2, 2],
  ['auto-deploy.yml', 1, 1],
  ['retry-vercel-production.yml', 1, 0],
];

for (const [name, expectedCheckouts, expectedNodeSetups] of protectedWorkflows) {
  test(`${name} uses least-privilege and immutable action versions`, () => {
    const contents = readFileSync(join(__dirname, '..', '.github', 'workflows', name), 'utf8');
    assert.match(contents, /^permissions:\r?\n  contents: read(?:\r?\n|$)/m);
    assert.doesNotMatch(contents, /^  (?:contents|actions|checks|issues|pull-requests|deployments|packages|statuses): write\s*$/m);
    const checkouts = [...contents.matchAll(/uses: actions\/checkout@([0-9a-f]{40})/g)];
    const nodes = [...contents.matchAll(/uses: actions\/setup-node@([0-9a-f]{40})/g)];
    const disabledCredentials = [...contents.matchAll(/persist-credentials: false/g)];
    assert.equal(checkouts.length, expectedCheckouts, 'checkout must be pinned');
    assert.equal(nodes.length, expectedNodeSetups, 'setup-node must be pinned');
    assert.equal(disabledCredentials.length, expectedCheckouts, 'every checkout must discard Git credentials');
    assert.doesNotMatch(contents, /uses: actions\/(?:checkout|setup-node)@v\d/);
  });
}

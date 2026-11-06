'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

test('home StyleSheet declares each top-level style exactly once', () => {
  const source = fs.readFileSync(path.join(__dirname, '../components/home/homeStyles.ts'), 'utf8');
  const file = ts.createSourceFile('homeStyles.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let stylesObject;
  function visit(node) {
    if (ts.isVariableDeclaration(node)
      && ts.isIdentifier(node.name)
      && node.name.text === 'styles'
      && node.initializer
      && ts.isCallExpression(node.initializer)
      && node.initializer.arguments.length
      && ts.isObjectLiteralExpression(node.initializer.arguments[0])) {
      stylesObject = node.initializer.arguments[0];
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  assert.ok(stylesObject, 'home StyleSheet.create object must exist');
  const keys = stylesObject.properties
    .filter(ts.isPropertyAssignment)
    .map((property) => property.name.getText(file));
  const repeated = keys.filter((key, index) => keys.indexOf(key) !== index);
  assert.deepEqual(repeated, [], 'duplicate top-level style names override earlier declarations');
});

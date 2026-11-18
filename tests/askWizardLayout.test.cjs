'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const screen = fs.readFileSync(path.join(__dirname, '../app/ask.tsx'), 'utf8');

test('new post has all six types and a two-step progression', () => {
  for (const key of ['inquiry','help','tool_sharing','donate','emergency','school_transport']) {
    assert.ok(screen.includes("key: '" + key + "'"));
  }
  assert.ok(screen.includes('testID="ask-primary"'));
  assert.ok(screen.includes('styles.stepPillActive'));
  assert.ok(screen.includes('styles.backStep'));
  assert.ok(screen.includes("if (step === 1) changeStep(2); else void save();"));
  assert.ok(screen.includes('accessibilityState={{ selected: active }}'));
});

test('publishing keeps safety checks and private location editor', () => {
  for (const key of [
    'includesPrivateSchoolDetails(body)',
    'detectEmergencyAndSafetyAI',
    'findProfanity(combinedText)',
    'PublishLocationEditor',
    'showPreview ? <View style={styles.previewCard}>',
    ".from('requests')",
    ".from('questions')",
  ]) assert.ok(screen.includes(key), key);
});

test('compact category cards have RTL layout and distinct selected state', () => {
  assert.ok(screen.includes("typeGrid: { flexDirection: 'row-reverse'"));
  assert.ok(screen.includes("typeCard: { width: '48.5%', minHeight: 103"));
  assert.ok(screen.includes('styles.selectionActive'));
  assert.ok(screen.includes('numberOfLines={2} style={styles.typeHint}'));
  assert.ok(!screen.includes("screen: { flex: 1, backgroundColor: 'transparent' }"));
});

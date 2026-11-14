'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../components/profile/ProfileHeader.tsx'), 'utf8');

test('profile icon actions meet 44px touch-target size on compact screens', () => {
  assert.match(source, /iconButton: \{ minWidth: 44, width: 44, minHeight: 44/);
  assert.doesNotMatch(source, /width: width < 600 \? 36 : 44/);
  assert.doesNotMatch(source, /width:36,paddingHorizontal:0/);
});

test('profile controls announce follow state and follower counts', () => {
  assert.match(source, /accessibilityState=\{\{ selected: Boolean\(props\.following\), busy: Boolean\(props\.busy\) \}\}/);
  assert.match(source, /stats\.followers\.toLocaleString\('ar-SA'\)/);
  assert.match(source, /stats\.following\.toLocaleString\('ar-SA'\)/);
});

test('RTL metadata wraps and cover preview only appears with a cover', () => {
  assert.match(source, /metadataText: \{ flexShrink: 1, fontSize: 12, lineHeight: 19, textAlign: 'right' \}/);
  assert.match(source, /!!props\.coverUri && props\.onCoverPreview/);
  assert.match(source, /actionsCompact: \{ flexGrow: 1, flexShrink: 1/);
});

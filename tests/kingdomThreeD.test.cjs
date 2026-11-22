'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = p => fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const engine = read('components/game/KingdomWorld3D.web.tsx');
const page = read('app/kingdom.web.tsx');
const preview = read('components/game/AvatarPreview3D.web.tsx');
const native = read('app/kingdom.tsx');
const sql = read('supabase/migrations/20261118213803_hayna_kingdom_3d_avatar_selection.sql');
const nav = read('components/BottomNav.tsx');

test('Three.js scene is an open world, not a two-dimensional category grid', () => {
  for (const sample of [
    'new THREE.WebGLRenderer', 'new THREE.PerspectiveCamera',
    'renderer.setAnimationLoop', 'new THREE.PlaneGeometry(WORLD_HALF * 2',
    'generateWorld(scene', 'new THREE.InstancedMesh', 'function castle(',
    'function addHouse(', 'makeRoad(', 'addTower(', 'labelSprite(',
    'for (const site of SITES)', 'buildAvatar(avatarKey)', 'avatar.leftLeg.rotation.x',
    'camera.position.lerp', 'onPointerDown', 'onPointerMove',
    'setPointerCapture', 'control.current.sprint', 'control.current.jump',
  ]) assert.ok(engine.includes(sample), 'Missing: ' + sample);
  assert.ok(engine.includes('renderer.dispose()'));
  assert.ok(engine.includes('renderer.setAnimationLoop(null)'));
  assert.match(engine, /export const WORLD_HALF = 185/);
  assert.match(nav, /HIDDEN_PREFIXES = .*'\/kingdom'/);
  assert.ok(native.includes('hayna_game_command'), 'Keep native fallback playable');
});

test('six unique player models and profile choices are supported', () => {
  const keys = ['knight','ranger','warrior','desert','captain','mage'];
  for (const key of keys) {
    assert.ok(engine.includes("key: '"+key+"'"), 'No avatar profile: '+key);
    assert.ok(sql.includes("'"+key+"'"), 'Not allowed by DB: '+key);
  }
  assert.match(page, /hayna_game_set_avatar/);
  assert.match(page, /p_avatar_key: key/);
  assert.match(page, /AVATARS\.map/);
  assert.match(page, /AvatarPreview3D avatarKey=\{previewKey\}/);
  assert.match(page, /onClick=\{\(\) => setPreviewKey\(person\.key\)\}/);
  assert.match(page, /chooseAvatar\(previewKey\)/);
  assert.match(preview, /renderer\.setAnimationLoop/);
  assert.match(preview, /buildAvatar\(avatarKey\)/);
  assert.match(page, /setAvatar\(key\)/);
  assert.match(page, /localStorage\.setItem\('hayna-kingdom-avatar-intro-'/);
});

test('world controls and game economy remain accessible on web and mobile browsers', () => {
  assert.match(page, /KingdomWorld3D avatarKey=\{avatar\}/);
  assert.match(page, /onPosition=\{setPosition\}/);
  assert.match(page, /onRemember=\{remember\}/);
  assert.match(page, /hayna_game_join/);
  assert.match(page, /hayna_game_state/);
  assert.match(page, /hayna_game_command/);
  assert.match(page, /<svg viewBox="0 0 320 320"/);
  assert.match(page, /state\.targets\.map/);
  assert.match(page, /state\?\.leaders\.map/);
  assert.match(engine, /onPointerDown=\{startStick\}/);
  assert.match(engine, /onPointerUp=\{endStick\}/);
  assert.match(engine, /onPointerCancel=\{endStick\}/);
  assert.match(engine, /keyboard\.has\('arrowup'\)/);
  assert.match(engine, /code === 'space'/);
});

test('story campaign guides the player through the kingdom and persists chapter progress', () => {
  const storyPage = read('app/kingdom.web.tsx');
  for (const chapter of ['رسالة من القرية القديمة','إعادة إشعال المملكة','نداء الحراس','أسوار لا تنحني','قراصنة الضباب','راية العهد','توحيد الجزر']) {
    assert.ok(storyPage.includes(chapter), 'Missing story chapter: ' + chapter);
  }
  assert.match(storyPage, /hayna-kingdom-story-/);
  assert.match(storyPage, /panel === 'story'/);
  assert.match(storyPage, /STORY_CHAPTERS\[storyProgress\]/);
});

test('the 3D kingdom contains animated residents and expanded KayKit structures', () => {
  const assets = read('components/game/KingdomAssets.web.ts');
  for (const npc of ["model: 'Rogue'","model: 'Mage'"]) assert.ok(assets.includes(npc));
  assert.match(assets, /new THREE\.AnimationMixer\(gltf\.scene\)/);
  assert.match(assets, /update\(dt: number\)/);
  assert.match(assets, /building_tower_A_blue/);
  assert.match(assets, /decoration\/props\/crate_A_big/);
  assert.match(engine, /worldAssets\.update\(dt\)/);
});

test('avatar persistence checks ownership and disallows arbitrary write access', () => {
  assert.match(sql, /auth\.uid\(\)/);
  assert.match(sql, /where user_id = v_uid/);
  assert.match(sql, /if v_key not in/);
  assert.match(sql, /revoke all on function public\.hayna_game_set_avatar\(text\) from public, anon/);
  assert.match(sql, /grant execute on function public\.hayna_game_set_avatar\(text\) to authenticated/);
  assert.doesNotMatch(page, /\.from\('profiles'\)/);
  assert.doesNotMatch(page, /latitude|longitude|avatar_url|display_name/);
});

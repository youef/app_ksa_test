'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const game = fs.readFileSync(path.join(__dirname, '../app/kingdom.tsx'), 'utf8');
const sql = fs.readFileSync(path.join(__dirname, '../supabase/migrations/20261119001500_hayna_anonymous_island_strategy.sql'), 'utf8');
const more = fs.readFileSync(path.join(__dirname, '../app/more.tsx'), 'utf8');
const layout = fs.readFileSync(path.join(__dirname, '../app/_layout.tsx'), 'utf8');
const bottomNav = fs.readFileSync(path.join(__dirname, '../components/BottomNav.tsx'), 'utf8');

test('anonymous island strategy is playable from the discovery menu', () => {
  assert.match(more, /href: '\/kingdom'/);
  assert.match(layout, /'\/kingdom'/);
  assert.match(bottomNav, /\['\/kingdom', '\/more'\]/);
  assert.match(game, /hayna_game_join/);
  assert.match(game, /hayna_game_state/);
  assert.match(game, /hayna_game_command/);
  assert.match(game, /TILES\.map/);
  assert.match(game, /state\.targets\.map/);
  assert.match(game, /state\.leaders\.map/);
  for (const name of ['collect', 'recruit', 'fortify', 'upgrade', 'pirates', 'attack']) {
    assert.ok(game.includes(name), 'Missing game command: ' + name);
  }
});

test('database never trusts resources or battle results from the player client', () => {
  assert.match(sql, /alter table public\.hayna_game_captains enable row level security/);
  assert.match(sql, /alter table public\.hayna_game_battles enable row level security/);
  assert.match(sql, /revoke all on public\.hayna_game_captains from public, anon, authenticated/);
  assert.match(sql, /security definer/);
  assert.match(sql, /set search_path = public, pg_temp/);
  assert.match(sql, /if v_user is null then raise exception/);
  assert.match(sql, /order by id for update/);
  assert.match(sql, /p_target_id = v_id/);
  assert.match(sql, /p_action = 'pirates'/);
  assert.match(sql, /last_attack_at > now\(\) - interval '2 minutes'/);
  assert.match(sql, /shield_until > now\(\)/);
  assert.match(sql, /revoke all on function public\.hayna_game_command\(text, uuid\) from public, anon/);
  assert.match(sql, /grant execute on function public\.hayna_game_command\(text, uuid\) to authenticated/);
  assert.match(sql, /to_jsonb\(v_me\) - 'user_id'/);
});

test('rival discovery does not expose Hayna account identity or home location', () => {
  const match = sql.match(/select id, alias, level, trophies, fortress\s+from public\.hayna_game_captains/);
  assert.ok(match, 'Rival list only shows anonymous game attributes');
  assert.doesNotMatch(game, /from\('profiles'\)/);
  assert.doesNotMatch(game, /avatar_url|display_name|district|latitude|longitude/);
  assert.match(game, /لا تظهر أسماء حسابات حيّنا ولا المدن أو الأحياء/);
});

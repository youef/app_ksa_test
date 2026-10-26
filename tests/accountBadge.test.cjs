const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const colors = { primary: '#047857', surface: '#fff', ink: '#111', muted: '#666', line: '#ddd', soft: '#eee', deep: '#064e3b', infoSoft: '#eef', warningSoft: '#ffe', background: '#fafafa' };
const view = ({ children, accessibilityLabel, testID }) => React.createElement('div', { 'aria-label': accessibilityLabel, 'data-testid': testID }, children);
const native = { View: view, Text: view, Pressable: view, Image: () => React.createElement('img'), ActivityIndicator: view, useWindowDimensions: () => ({ width: 1200, height: 900 }), StyleSheet: { create: value => value, absoluteFillObject: {} } };
const icons = new Proxy({}, { get: (_target, name) => props => React.createElement('svg', { 'data-icon': String(name) }) });
function loadSource(relative, dependencies = {}) {
  const filename = path.resolve(__dirname, '..', relative);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  const module = new Module(filename);
  module.require = name => {
    if (name === 'react') return React;
    if (name === 'react-native') return native;
    if (name === 'lucide-react-native') return icons;
    if (name === '@/lib/oasis') return { OASIS: { colors } };
    if (name in dependencies) return dependencies[name];
    throw new Error(`Unexpected dependency: ${name}`);
  };
  module._compile(code, filename);
  return module.exports;
}
const badges = loadSource('components/profile/AccountIdentityBadge.tsx');
const { ProfileHeader } = loadSource('components/profile/ProfileHeader.tsx', {
  './AccountIdentityBadge': badges,
  '@/context/ThemeContext': { useTheme: () => ({ colors }) },
  '@/lib/profileTheme': { bannerColors: () => ['#111', '#222', '#333'] },
  'expo-linear-gradient': { LinearGradient: view },
});
function renderHeader(profile, customization) {
  return renderToStaticMarkup(React.createElement(ProfileHeader, { profile: { display_name: 'جار', username: 'neighbor', ...profile }, customization, stats: { followers: 1, following: 2, contributions: 3, reputation: 4 }, coverUri: '' }));
}
test('admin profile has one official mark and no avatar seal or extra badges', () => {
  const html = renderHeader({ role: 'admin', account_type: 'standard', is_verified: true });
  assert.equal((html.match(/data-testid="account-status-mark"/g) || []).length, 1);
  assert.equal((html.match(/إدارة حيّنا الرسمية/g) || []).length, 1);
  assert.equal((html.match(/data-icon="Crown"/g) || []).length, 1);
});
test('verified individual has one mark; hiding badges removes it', () => {
  assert.equal((renderHeader({ is_verified: true }).match(/data-testid="account-status-mark"/g) || []).length, 1);
  assert.equal((renderHeader({ is_verified: true }, { show_badges: false }).match(/data-testid="account-status-mark"/g) || []).length, 0);
});
test('unverified individual is not presented as verified', () => {
  assert.equal((renderHeader({ is_verified: false, account_type: 'standard' }).match(/data-testid="account-status-mark"/g) || []).length, 0);
});
test('verified business uses a single combined identity badge', () => {
  const html = renderToStaticMarkup(React.createElement(badges.AccountIdentityBadge, { accountType: 'merchant', isVerified: true }));
  assert.equal((html.match(/<svg/g) || []).length, 1);
  assert.ok(html.includes('نشاط تجاري موثّق'));
});
test('legacy avatar identity icon does not add a second verification dot', () => {
  const html = renderToStaticMarkup(React.createElement(badges.AccountIdentityIcon, { role: 'admin', isVerified: true }));
  assert.equal((html.match(/<svg/g) || []).length, 1);
});

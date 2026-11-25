const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.resolve(__dirname, '../app/auth.tsx'), 'utf8');

test('login and registration modes form a labelled radio group', () => {
  assert.match(source, /accessibilityRole="radiogroup"[\s\S]*accessibilityLabel="طريقة الدخول"/);
  assert.match(source, /accessibilityRole="radio"[\s\S]*accessibilityState=\{\{ selected: isLogin/);
  assert.match(source, /accessibilityState=\{\{ selected: !isLogin/);
});

test('mode choices provide a 48px minimum target and disabled state while submitting', () => {
  assert.match(source, /segmentBtn:\s*\{[\s\S]*minHeight: 48/);
  assert.match(source, /disabled=\{loading\}/);
});

test('username and email inputs expose labels, hints and autofill metadata', () => {
  assert.match(source, /accessibilityLabel="معرف المستخدم"/);
  assert.match(source, /autoComplete="username"/);
  assert.match(source, /accessibilityLabel="البريد الإلكتروني"/);
  assert.match(source, /autoComplete="email"/);
  assert.match(source, /textContentType="emailAddress"/);
});

test('password field exposes current/new-password autofill and a 44px visibility control', () => {
  assert.match(source, /autoComplete=\{isLogin \? 'current-password' : 'new-password'\}/);
  assert.match(source, /textContentType=\{isLogin \? 'password' : 'newPassword'\}/);
  assert.match(source, /accessibilityState=\{\{ expanded: showPassword \}\}/);
  assert.match(source, /eyeButton:\s*\{[\s\S]*width: 44,[\s\S]*height: 44/);
});

test('keyboard actions move between fields and submit from password', () => {
  assert.match(source, /onSubmitEditing=\{\(\) => emailRef\.current\?\.focus\(\)\}/);
  assert.match(source, /onSubmitEditing=\{\(\) => passwordRef\.current\?\.focus\(\)\}/);
  assert.match(source, /onSubmitEditing=\{\(\) => \{ void submit\(\); \}\}/);
});

test('validation and auth feedback are inline and announced accessibly', () => {
  assert.ok(!source.includes('Alert.alert'));
  assert.match(source, /accessibilityRole="alert"/);
  assert.match(source, /accessibilityLiveRegion="polite"/);
  assert.match(source, /formError \? \(/);
  assert.match(source, /formNotice \? \(/);
});

test('screen surfaces and focus borders follow the active OASIS theme', () => {
  assert.match(source, /const \{ colors, isDark \} = useTheme\(\)/);
  assert.match(source, /backgroundColor: colors\.surface/);
  assert.match(source, /backgroundColor: colors\.soft/);
  assert.match(source, /focusedField === 'email' \? colors\.primary : colors\.line/);
  assert.match(source, /formContainer:[\s\S]*borderRadius: 22/);
});

test('safe area and keyboard-aware scrolling remain in place', () => {
  assert.match(source, /useSafeAreaInsets/);
  assert.match(source, /paddingBottom: Math\.max\(insets\.bottom, 16\)/);
  assert.match(source, /KeyboardAvoidingView/);
  assert.match(source, /keyboardShouldPersistTaps="handled"/);
});

test('existing authentication and guest navigation flows are preserved', () => {
  assert.match(source, /supabase\.rpc\('is_username_available'/);
  assert.match(source, /supabase\.auth\.signUp/);
  assert.match(source, /supabase\.auth\.signInWithPassword/);
  assert.match(source, /supabase\.auth\.getSession/);
  assert.match(source, /router\.replace\('\/home'\)/);
  assert.match(source, /تصفح كزائر دون تسجيل/);
});

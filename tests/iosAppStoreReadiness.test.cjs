'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = path => fs.readFileSync(path, 'utf8');
const app = JSON.parse(read('app.json')).expo;
const pkg = JSON.parse(read('package.json'));
const eas = JSON.parse(read('eas.json'));
const privacy = read('app/privacy.tsx');
const terms = read('app/terms.tsx');
const safety = read('app/safety-center.tsx');
const account = read('components/account/AccountCenter.tsx');
const deletion = read('supabase/functions/delete-account/index.ts');
const nativeTelemetry = read('lib/logrocket.native.ts');
const webTelemetry = read('lib/logrocket.web.ts');
const consent = read('lib/telemetryConsent.ts');
const layout = read('app/_layout.tsx');
const icon = fs.readFileSync('public/brand/HAYNA_APP_ICON.png');
const audit = read('docs/ios-app-store-readiness-2026-11-24.md');
const iconCheck = read('scripts/check-ios-app-icon.cjs');

test('Expo and React Native versions and iOS app identity are pinned as audited', () => {
  assert.match(pkg.dependencies.expo, /^~54\./);
  assert.equal(pkg.dependencies['react-native'], '0.81.5');
  assert.equal(app.ios.bundleIdentifier, 'sa.hayna.app');
  assert.equal(app.ios.supportsTablet, true);
  assert.equal(app.ios.icon, './public/brand/HAYNA_APP_ICON.png');
  assert.equal(eas.build.production.autoIncrement, true);
  assert.equal(eas.build.production.ios.image, 'macos-sequoia-15.6-xcode-26.0');
  assert.equal(eas.build.testflight.ios.image, 'macos-sequoia-15.6-xcode-26.0');
  assert.equal(eas.build.production.node, '24.11.1');
  assert.equal(eas.build.testflight.node, '24.11.1');
});

test('iOS purpose strings cover camera, microphone, photos and location', () => {
  assert.match(app.ios.infoPlist.NSCameraUsageDescription, /الكاميرا/);
  assert.match(app.ios.infoPlist.NSMicrophoneUsageDescription, /الميكروفون/);
  const picker = app.plugins.find(plugin => Array.isArray(plugin) && plugin[0] === 'expo-image-picker');
  const location = app.plugins.find(plugin => Array.isArray(plugin) && plugin[0] === 'expo-location');
  assert.ok(picker, 'expo-image-picker config plugin is present');
  assert.match(picker[1].photosPermission, /صورك/);
  assert.match(picker[1].cameraPermission, /الكاميرا/);
  assert.equal(picker[1].microphonePermission, false);
  assert.match(location[1].locationWhenInUsePermission, /موقعك/);
  const buildProperties = app.plugins.find(plugin => Array.isArray(plugin) && plugin[0] === 'expo-build-properties');
  assert.equal(buildProperties[1].ios.deploymentTarget, '15.1');
});

test('privacy policy discloses the service providers and data categories found in source', () => {
  for (const term of ['Supabase', 'Expo', 'Google Maps', 'MapLibre', 'LiveKit', 'LogRocket', 'الموقع', 'رمز الإشعارات', 'عنوان IP', 'حذف حسابك', 'support@hayna.app', 'الولايات المتحدة']) {
    assert.ok(privacy.includes(term), `privacy policy must disclose ${term}`);
  }
  assert.ok(privacy.includes('لا نبيع بياناتك'));
});

test('privacy policy is discoverable from the in-app terms and safety center', () => {
  assert.ok(terms.includes("router.push('/privacy')"));
  assert.ok(safety.includes("router.push('/privacy')"));
});

test('account deletion is reachable in the app and invokes the server deletion function', () => {
  assert.ok(account.includes('إدارة الحساب'));
  assert.ok(account.includes('حذف الحساب'));
  assert.ok(account.includes("supabase.functions.invoke('delete-account')"));
  assert.ok(deletion.includes('admin.auth.admin.deleteUser(user.id)'));
});

test('session replay and network sanitization are disclosed', () => {
  assert.ok(nativeTelemetry.includes('LogRocket.init'));
  assert.ok(nativeTelemetry.includes('LogRocket.shutdown'));
  assert.ok(webTelemetry.includes('shouldSendData: () => consentEnabled'));
  assert.ok(consent.includes("'granted'"));
  assert.ok(consent.includes('shutdownLogRocket'));
  assert.ok(layout.includes('getTelemetryConsent().then(granted => {'));
  assert.ok(nativeTelemetry.includes('textSanitizer'));
  assert.ok(nativeTelemetry.includes('headers: {}, body: null'));
  assert.ok(privacy.includes('بيانات الجلسة والتفاعل'));
  assert.ok(privacy.includes('LogRocket'));
  assert.ok(privacy.includes('متوقف افتراضيًا'));
  assert.ok(privacy.includes('موافقتك الصريحة'));
  assert.ok(privacy.includes('setTelemetryConsent'));
});

test('the configured source icon is square and its App Store export issue remains documented', () => {
  assert.equal(icon.toString('ascii', 1, 4), 'PNG');
  assert.equal(icon.readUInt32BE(16), icon.readUInt32BE(20), 'source icon must be square');
  assert.ok(audit.includes('929×929'));
  assert.ok(audit.includes('1024×1024'));
  assert.ok(audit.includes('alpha channel'));
  assert.ok(iconCheck.includes('1024'));
  assert.ok(iconCheck.includes('colorType === 4 || item.info.colorType === 6'));
});

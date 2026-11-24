# iOS App Store readiness audit — حيّنا

Date: 2026-11-24  
Repository: `youef/app_ksa_test`  
Base reviewed: `main` at `587659c852f5e212bebdd53212c63d76fa80a751`  
Branch: `compliance/ios-app-store-readiness-20261124`

## Execution plan
1. Inspect current main, open PRs, Expo/EAS config, native project generation, permissions, account deletion, authentication, telemetry and store-facing assets.
2. Avoid conflicts with existing PRs. Existing open work includes #185 (About), #184 (auth UX), #183 (profile), #182 (safety center), #181 (rating), #180 (service detail), #179 (reporting), #128 (notifications), #123/#96 (favorites), #101/#100/#99 (profile), #84/#56 (market), #82 (cross-platform release gates), and #17 (older iOS release guide). This PR is limited to the missing privacy-policy route, its in-app discoverability, and this iOS release audit.
3. Implement an in-app/web privacy-policy route and update the existing terms disclosure to reflect service providers currently present in source.
4. Add focused regression tests and a PR workflow for TypeScript, Web export, iOS JS bundle export and the audit tests.
5. Keep the PR Draft. Do not submit, merge or publish production until the remaining native, legal and human-review gates are complete.

## Current project baseline
- Expo SDK: `~54.0.0`; React Native: `0.81.5`; Expo Router: `~6.0.24`.
- App display name: `حيّنا`; slug: `hayna`; version: `1.0.0`; iOS bundle ID: `sa.hayna.app`; iPad support enabled.
- EAS project ID is configured; build profiles include `production` and `testflight`.
- No committed `ios/` directory or Xcode project exists. This is a Continuous Native Generation (CNG) Expo project; EAS/Xcode generates native files during build.
- Expo's SDK 54 EAS build image defaults to Xcode 26. Expo SDK 54 supports iOS 15.1 and later. This satisfies Apple's current minimum upload toolchain (Xcode 26+ with iOS 26 SDK or later) and minimum deployment target rule (iOS 13 or later). SDK 58 is the current Expo release and is built for iOS 27, but upgrading to it is not required for the current App Store upload minimum and would raise the Expo-supported minimum iOS version to 16.4. Keep SDK upgrades as a separate, regression-tested migration.
- No social OAuth provider was found in the current auth screen; it uses the app's own email/password sign-in and guest access. Sign in with Apple is therefore not triggered by a third-party social-login implementation in the reviewed source.
- No StoreKit, `react-native-iap`, or RevenueCat dependency was found. Any future sale of digital content or digital functionality must be reviewed for Apple's In-App Purchase rules. Physical goods and services consumed outside the app follow different payment rules.

## Findings before changes
### Fixed in this PR
- The app had no `app/privacy.tsx` route, while the Safety Center linked to `https://appksatest.vercel.app/privacy`.
- Terms clause 7 listed Supabase and Push only, omitting other processors visible in app configuration/source.
- A public policy route and accurate in-app disclosure are required for App Store submission.

### Existing implementation confirmed
- Account deletion is reachable from Profile > Settings > Account management and calls the `delete-account` Supabase Edge Function.
- The deletion function removes the authenticated account and attempts to remove user media from the configured storage buckets. The app should be tested end-to-end with a real review account; provider logs/backups and any records retained for legal/safety reasons need a documented retention schedule.
- Photo-library and camera access are requested by image-upload flows; location is requested by location-dependent features; camera/microphone purpose strings exist for live features; the image-picker plugin disables its own microphone permission.
- Authentication uses the app's own email/password system plus guest access. No Google/Facebook/Apple OAuth provider was found in the current auth source.
- LogRocket is initialized at app startup on native and web. The native config enables session diagnostics/replay, sanitizes text, and strips request/response headers and bodies. This is a third-party data processor and is now disclosed in the policy. Confirm LogRocket's retention, data residency, contract and App Store privacy-label answers with the account owner.
- Google Maps/MapLibre, LiveKit, Supabase, Expo/Apple push delivery and LogRocket are present in the app's configuration or runtime source.

### App icon finding — still a release blocker
- Configured source: `public/brand/HAYNA_APP_ICON.png`.
- PNG IHDR: **929×929**, 8-bit RGBA (color type 6, therefore an alpha channel).
- App Store icon export must be **1024×1024 without an alpha channel**. The source asset is not itself at that specification. This branch adds a CI step that runs Expo prebuild and inspects the generated AppIcon asset; if Expo does not flatten/resize it correctly, CI will fail and a confirmed 1024px non-transparent source asset must be supplied. Validate the generated AppIcon again in a signed iOS archive before submission.

## Apple requirements checked (2026-11-24)
- Since 2026-04-28, App Store Connect uploads must be built with Xcode 26 or later and an iOS 26 SDK or later.
- Since 2026-09-09, uploaded iOS apps must target iOS 13 or later.
- Account-creating apps must provide in-app account deletion.
- A third-party social login may trigger the Sign in with Apple equivalent-login rule, subject to Apple's exceptions. The current reviewed auth flow uses the app's own credentials.
- A privacy policy URL must be provided in App Store Connect and the policy must explain collection, use, sharing and deletion. This PR adds the in-app/web route; the production URL must be tested after merge/deployment.
- User-generated-content features require moderation controls, reporting and blocking; source review shows report and block entry points, but human moderation operations and response SLAs still require owner verification.
- Digital goods/features sold inside the app generally require In-App Purchase. No IAP SDK was found; confirm no digital purchase flow is being sold through external payment links.

## Remaining release gates — not claimed complete
1. Replace or regenerate the icon and inspect the final AppIcon asset catalog/archive for 1024×1024 and no alpha.
2. Obtain legal/product-owner confirmation of the policy wording, data controller identity, retention periods, cross-border processing, LogRocket agreement/retention and App Store privacy nutrition labels.
3. Verify the policy URL publicly from a signed-out browser on the final production domain.
4. Confirm camera, microphone, photos, location and notification prompts appear only at the relevant user action and that denial has a usable fallback.
5. Test account deletion end-to-end, including associated profile/content rows, all storage buckets, LogRocket/vendor retention and re-authentication.
6. Provide a working App Review account and reviewer instructions for gated features, if required.
7. Complete App Store Connect metadata: support URL, privacy URL, age-rating answers, content rights, export-compliance answers, screenshots for supported iPhone/iPad sizes, and contact information.
8. Build and launch a signed iOS archive with Xcode 26+ / iOS 26 SDK or later on an actual Apple toolchain; run iPhone/iPad smoke tests and VoiceOver/Dynamic Type checks.
9. Complete TestFlight validation and human PR review before any production release.

## Verification and blockers
- Focused source/config regression test: added in this branch.
- TypeScript, Expo Web export and iOS JavaScript bundle export: configured in the new PR workflow; results must be read from the current PR head before approval.
- No native Xcode archive or device QA is claimed by a JavaScript bundle export.
- The Expo connector rejected read access to the configured EAS project (`Entity Not Authorized`). No cloud iOS build was started, no Apple credentials were accessed, and no submission was attempted.
- No production deployment, merge, App Store Connect submission or store release was performed.

## Before / after
- Before: a Safety Center link pointed to a missing in-repository privacy route; terms disclosed only Supabase/Push despite other runtime processors.
- After: a public Expo Router `/privacy` page explains current data categories, permissions, processors, diagnostics, account deletion and support contact; terms now name the service providers and link directly to the policy.

## Next step
Resolve the icon asset and legal/provider retention confirmations, then run an authenticated EAS iOS build and TestFlight device review. Do not mark this app App Store-ready until every release gate above is verified.

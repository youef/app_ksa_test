# Hayna mobile build request — 2026-10-29

Build from this isolated branch. Source is copied from main at the time of branching.

- Android: APK, EAS profile `preview`.
- iOS: IPA for TestFlight, EAS profile `testflight` (Apple signing credentials required).
- Workflow: `.eas/workflows/mobile-builds.yml`.
- No automatic store submissions.
- Android minimum configured SDK: API 25 (Android 7.1); iOS on Expo SDK 54 starts at iOS 15.1.

This commit intentionally triggers the EAS Workflow via its branch-scoped push event, provided the GitHub-to-Expo integration is enabled.

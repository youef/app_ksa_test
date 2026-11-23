# About screen UX results — 2026-11-23

## Scope
Only `app/about.tsx` UX/UI, a focused static regression test, and a screen-specific GitHub Actions workflow were changed. No data, backend, authentication, routes, developer contact values, or other screens were changed.

## Before → after
- Fixed/light palette and disconnected surface colors → theme-aware OASIS semantic tokens with a stable dark brand hero.
- Asymmetric intro bubble and small feature artwork → full-width responsive card, clearer heading hierarchy and 44px feature-icon surfaces.
- 680px content cap / 14px gutters → 760px cap / 16px gutters.
- Contact buttons without explicit target sizing → WhatsApp 52px and secondary actions 48px.
- Decorative icons could be announced → hidden from assistive technology; section headings and contact controls now have labels/hints.
- Email/share launch failures were silently ignored → localized fallback feedback; call/WhatsApp recovery wording is clearer.

## Verified checks on commit `25714d8e4298694b8c6fe9f77178779fd5ecf848`
- TypeScript: **passed**.
- Expo Web export: **passed**.
- Focused About UX test: **5/5 passed**.
- Marketplace integration safety suite: **passed**.
- Inquiry discussion checks: **passed**.
- Vercel preview statuses: **success** (preview only; no production deployment).

The first About workflow run failed TypeScript because React Native TextProps in this project do not support `writingDirection`. The phone-number direction was changed to a wrapper View style (`direction: 'ltr'`), and all About workflow checks passed on the corrected commit.

## Not verified
- Visual review on real iPhone, Android, iPad, and web browsers.
- VoiceOver / TalkBack and enlarged text checks.
- Human PR review/approval.

The repository's broad Marketplace workflow was automatically triggered by the application-path change and ran its full test suite; it passed. No game or TV feature files were modified or directly worked on in this design batch.

## Release status
PR #185 remains **Draft**, unmerged, and not deployed to production. Keep it that way until required manual QA and review are complete.

## Next page
`app/support.tsx` — support overview and support-entry navigation. Before starting, recheck open PRs for overlap.

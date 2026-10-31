# Hayna cross-platform release quality gates

This document defines the acceptance checks for the iOS-like UX refresh across iPhone, Android, and web. It is a release checklist, not a claim that any feature has been implemented.

## Mandatory pre-merge checks
- Run `npm ci`, `npm run typecheck`, `npm run build`, and all relevant `node --test tests/*.test.cjs` checks.
- Verify Arabic RTL on iPhone SE-sized, standard iPhone, Android narrow and tablet layouts; check safe areas, bottom navigation, keyboard and text scaling.
- Verify loading, empty, offline, denied permission, expired session and retry states for home, questions, chat, stories, market, profile, admin.
- Verify no regression to accessibility labels, touch targets, contrast, reduced motion, dark mode or screen readers.
- Verify role-specific Supabase RLS for each affected table using a disposable database; never use service-role credentials in client bundles.
- Verify actual native builds on supported iOS and Android devices; a Metro export alone is not a signed native build.
- Check Vercel preview and response headers before promoting production. Validate event ingestion in PostHog.
- Verify rollback to last known-good deployment and database backup restoration before any sensitive migration.

## Design principles
- iOS-inspired, not iOS-only: native-feeling typography, coherent spacing and transitions, clear section hierarchy, predictable navigation.
- Keep RTL as the default for Arabic and test mixed-direction numbers, emails and URLs.
- Respect platform conventions for Android back navigation, keyboard avoidance and permissions.
- Use existing shared components and design tokens instead of copying screen-specific styles.
- Avoid blank feature destinations; show a useful empty state with a clear next action.
- Use progressive enhancement and avoid requiring a new backend column without a compatible migration.

## Batch rules
Group related low-risk changes in one branch and one PR. Require green CI and a tested preview. Squash merge only after review. Security-sensitive RLS and destructive data changes need separate explicit review and a rollback plan.

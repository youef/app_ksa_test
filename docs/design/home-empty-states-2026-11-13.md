# Home empty and filtered results — 2026-11-13

## Plan (before changes)
Scope only `components/home/EmptyState.tsx` and its shared home styles. Preserve existing tab/search/location decisions and navigation. Increase content hierarchy, RTL text readability and 44px CTA target. Expose heading and meaningful action to screen readers; hide decorative illustration.

## Before → after
- Empty panel: 24px vertical / 20px horizontal padding → 32px / 24px.
- Heading: 16px → 18px; description: 13px/20px → 14px/23px with RTL writing direction.
- CTA: no guaranteed minimum height → minimum 44px; label 13px → 14px.
- Decorative illustration announced unpredictably → hidden from accessibility tree; heading semantic role added.
- No changes to result matching, error/loading logic, routing, data or backend.

## Validation and release gates
Review diff and run repository TypeScript check, Web build and available tests in CI/local checkout; visually inspect 320px mobile, iPhone safe area, Android, tablet and Web; verify keyboard and VoiceOver/TalkBack. These checks are **not yet confirmed**. Keep PR draft; do not merge/deploy before passing checks and required review.

## Next section
Home feed loading skeletons and retry/error feedback (excluding already updated cards and filters).

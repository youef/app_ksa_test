# Home loading and error states — 2026-11-13

## Plan (before implementation)
Scope: only `components/home/HomeStates.tsx`, used by the home feed. Preserve data fetching, navigation, and retry callbacks. Align skeletons with feed cards (avatar, metadata, body), themed surfaces and spacing; respect Arabic RTL, light/dark modes, accessibility and reduced motion. Make retry target at least 44 px, indicate pending state, and avoid layout overflow on phones/tablets/web.

## Before → after
- Skeleton: three undifferentiated bars → avatar/metadata/body hierarchy, themed rounded card with consistent gaps.
- Animation: perpetual pulse → pulse disabled when the OS requests reduced motion.
- Error: legacy banner styling → themed, bordered card with readable right-aligned text and a 44 px minimum retry control.
- Pending retry: text only → activity spinner and disabled control, with accessibility busy state.

## Verification
Pending CI: TypeScript, Expo web export, and available tests. Manual checks still required on iPhone, Android, iPad and web, including dark mode, screen readers and reduced-motion settings. No merge/deploy until checks and review pass.

## Next
Home feed pagination/loading-more affordance and transition into the next page of results.

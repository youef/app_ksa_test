# Home stories strip — 2026-11-16

## Before
The home story strip uses fixed-width story cards, a permanent More action, and colored verification badges. The More label ignores dark-mode text color; the story image lacks a descriptive accessible alternative and verification is only visual. A four-story cap limits discovery even on tablets.

## Plan (before implementation)
1. Keep the Oasis palette and RTL layout, with compact cards and existing navigation.
2. Improve voice navigation: explain verified status and story type in button labels; mark decorative image as non-accessible to avoid duplicate reading.
3. Apply theme-aware label and icon colors to the More action; maintain adequate touch targets.
4. Increase visible story capacity on wide screens without changing data fetching or adding layout shifts.
5. Verify TypeScript, Expo Web and tests, then review iPhone/iPad/Android visuals before merging.

## Scope
Only `components/home/StoriesRow.tsx` and its design record. No security or other app changes.

## After / verification
Implemented in `components/home/StoriesRow.tsx`: themed More action, accessible story button descriptions including verified/text status, decorative avatar hidden from the screen reader, and eight visible stories on widths >= 768px (four on phones). Source-level review complete. TypeScript/Web/tests and device visual review not yet verified; leave draft PR unmerged. Existing Vercel preview deployments have been BLOCKED by verified-commit policy; this branch must be checked independently.

## Next
Home feed post-card typography and long Arabic text wrapping.

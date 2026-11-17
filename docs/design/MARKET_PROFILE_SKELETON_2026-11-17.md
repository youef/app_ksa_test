# Market and profile UI — 2026-11-17

## Design plan
- Market: replace generic loading spinner/state with product-shaped cards, matching the responsive market grid.
- Profile: replace generic spinner with cover, avatar, identity and stats placeholders.
- Shared: use a single responsive ContentSkeleton component with screen-reader loading labels, no flashing animation.
- Micro-interactions: next gated change after review of existing OasisPressable feedback; do not alter global interaction behavior without visual tests.

## Before → After
- Market: generic loading message → responsive listing placeholders.
- Profile: large spinner → structured profile preview.
- Both: consistent surface, corner radius, spacing and RTL-friendly rows.

## Validation and release gates
Source updates committed; TypeScript, web export, automated tests and iPhone/Android/iPad visual checks not run in this connector session. PR remains draft; do not merge or deploy.

## Next
Review market save/like action feedback and profile navigation press states; add restrained scale/opacity animation respecting reduced motion, with targeted tests.

# Favorites screen — refreshed visual UX / 2026-11-20

## Scope
Only app/favorites.tsx. Rework the favorite screen visuals while preserving its Supabase queries, item routes, filtering semantics, remove/rollback behavior, authentication and bottom-navigation inset. No other screen, backend, or project is changed.


## Before
- Purple hero, filter and action colors compete with the Oasis green identity.
- Hero, image cards and search hierarchy are compact and visually dated.
- Product/store imagery has limited emphasis and lacks a clear saved-state overlay.
- Narrow/mobile and tablet/web card rhythm needs more consistent spacing and rounded surfaces.


## After
- Oasis green gradient hero, stronger hierarchy, larger icon and better contrast.
- More spacious cards and image frames, rounded surfaces and clear type hierarchy.
- Saved-state chip on image cards; image type badge retained.
- Larger touch targets, clearer filter selection and search/reset affordances.
- RTL preserved; content width and bottom-nav inset preserved.
- No new animation dependency or continuous decorative motion.


## Checks
- Source edit validated by exact-string replacement guards.
- TypeScript, Expo Web export, Node tests, reduced-motion/screen-reader and device visual QA are pending/not run in this connector environment.
- Keep draft. No merge/deploy until CI and reviewer approval.


## Next
Continue with the profile screen UX on a separate task/branch after this PR is reviewed

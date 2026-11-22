# App Rating UX/UI Plan — 2026-11-22

## Scope and baseline
Single screen: `app/rate-app.tsx`. Keep the existing review record, upsert contract, auth route, rating values, reason strings, and feedback submission behavior unchanged.

Baseline observations from the current source:
- The page uses a fixed pale background and several fixed amber/slate colors, so it does not follow OASIS dark/light tokens consistently.
- The rating stars are 34px visual controls without a guaranteed 44px touch target or selected state announcement.
- Feedback reason chips visually toggle but do not expose checkbox semantics or checked state to assistive technology.
- The multiline feedback field has no explicit accessibility label/hint or live character counter despite its 1500-character limit.
- Initial review loading failures are shown only through a modal alert; the screen has no persistent retry affordance.
- The content is not capped/centered for tablet and wide web, and bottom spacing uses a fixed extra amount rather than explicitly protecting the bottom safe-area.

## Design plan (before implementation)
1. **Theme consistency:** replace screen/card/chip/field/score hard-coded colors with `OASIS.colors` semantic tokens. Keep the hero as a dark green branded gradient with high-contrast light copy; use theme warning tokens for star/score accents.
2. **Layout rhythm:** center a 100%-width content column capped at 640px, with 16px horizontal gutters, consistent 14–16px card gaps, and rounded 18–20px card surfaces. Preserve `AppHeader`; compute bottom padding from both the bottom-dock inset and safe-area inset.
3. **Hero hierarchy:** keep the current message, but align the icon tile, eyebrow, title, description and reassurance into a compact readable stack with clear Arabic RTL alignment.
4. **Rating interaction:** make each star control at least 44×44px, provide a clear Arabic accessible name, and announce the selected rating state. Keep the visual star glyph smaller than the hit area.
5. **Reason chips:** maintain the existing optional multi-select behavior and exact reason strings; expose checkbox/checked semantics, use theme-aware selected/unselected surfaces, and ensure a 44px minimum target.
6. **Feedback text:** add a label, short hint, and polite live count for the existing 1500-character limit. Keep multiline RTL text entry.
7. **Recovery:** replace the initial load-error modal-only path with a persistent, theme-aware error card and retry action. Preserve the signed-out state and the existing submit success/error alerts and upsert payload.
8. **Platform fit:** use natural scrolling, no fixed screen height, safe-area-aware bottom clearance, and responsive centered cards for phone/tablet/web. No decorative animation is added; pressed feedback remains lightweight.
9. **Accessibility:** meaningful button names, selected/checked state, live counter, and adequate contrast. Manual VoiceOver/TalkBack QA remains a reviewer gate.

## Before / after
- Fixed pale/amber styling → OASIS theme surfaces and semantic accents.
- Uncapped, loosely spaced layout → centered responsive column with consistent rhythm.
- Small stars and unlabeled selected chips → touch-sized stars and accessible multi-select state.
- Feedback field without explicit label/counter → labeled multiline input with polite live count.
- Load failure as a one-off alert → persistent error with in-place retry.

## Acceptance and verification
- Focused source-contract test for theme tokens, width/insets, star touch and selected state, reason checked state, textarea label/count, and load retry.
- GitHub Actions TypeScript and Expo Web export; focused test via a branch-specific design workflow.
- Physical-device QA on iPhone/Android/iPad and Web, including narrow widths, light/dark themes, keyboard, VoiceOver and TalkBack, not claimed in this environment.

## Next UI candidate after this PR
Inspect `app/more.tsx` after this batch; keep this PR limited to the rating screen.

# Service Detail UX Design Plan — 2026-11-22

## Scope
One screen only: `app/service.tsx` (service/listing details). Keep all service data queries, access checks, contact routing, price logic, edit limits, moderation, and deletion behavior unchanged. No backend/schema/security work.

## Baseline observed on `main`
- Header share/report hit targets are 34×34px.
- Gallery, placeholder, main-info, section, seller and related cards use mixed 14px radii; theme-aware borders are inconsistent with fixed pale-gray/green surfaces.
- Trust banner and status/location badges use fixed light-mode colors.
- Inline message/WhatsApp/phone actions use vertical padding without guaranteed minimum hit height.
- Related cards are 145px wide with 95px media.
- Owner edit/delete and modal-close targets have no consistent 44px minimum; edit modal content has no internal scroll region on short screens.
- Screen already uses AppHeader, RTL, an 800px content cap and bottom-nav inset. Preserve these shared patterns.

## Design goals
1. Align detail surfaces to OASIS theme tokens for both light and dark modes.
2. Establish consistent 16–20px card radii, spacing and borders without changing content or flows.
3. Guarantee 44–48px targets for header, contact, owner and modal actions.
4. Improve gallery and related-card accessibility announcements; hide purely decorative pagination dots from assistive technology.
5. Make title/price metadata wrap safely at narrow widths.
6. Respect the actual bottom safe-area inset on the hidden-dock service route and keep scroll content clear of the sticky action region.
7. Keep the edit sheet usable on short iPhone screens and tablet/web widths through bounded width and a scrollable form body.
8. Retain low-motion/native scroll and avoid new dependencies or expensive effects.

## Implementation steps
- Add safe-area inset reading; bound gallery width and increase scroll clearance.
- Make gallery image/dots/counter accessible.
- Increase share/report hit areas; replace fixed backgrounds/borders where OASIS tokens exist.
- Harmonize gallery, info, seller, section, delivery, owner and related-card surfaces.
- Add minimum heights and wrapping for contact/owner actions; keep existing action conditions and handlers.
- Constrain and scroll the edit sheet, improve input/action hit sizes, and offset lightbox close control from the safe area.
- Add a focused static design regression test for these screen-only contracts.

## Acceptance gates
- Focused service-detail design test passes.
- TypeScript and Expo Web export pass on GitHub Actions.
- Existing applicable tests pass.
- Review iPhone/Android/iPad/web, keyboard, safe-area and VoiceOver/TalkBack states before approval.
- Draft only until checks are green and review is satisfied. No merge or production deploy from this batch.

## Before / after
| Area | Before | Target |
|---|---|---|
| Header actions | 34px | 44px |
| Card radius | mixed 14px | consistent 16–20px |
| Light/dark surfaces | several fixed light colors | OASIS surface/soft/line tokens |
| Contact / owner actions | padding-based sizes | explicit 44–48px minimum |
| Related offers | 145px / 95px image | 160px / 112px image, more breathing room |
| Edit modal | 90% max-height, no inner scroll | bounded tablet width, safe-area padding, scrollable form |
| Gallery accessibility | unlabeled images/counter, visible dots | labeled image/counter; decorative dots hidden |

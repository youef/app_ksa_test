# Safety Center UX plan — 2026-11-23

## Scope and baseline

Target only `app/safety-center.tsx`. The current page has a useful safety/reporting structure, but the visual rhythm is inconsistent: the hero and emergency surface use 14px corners while other cards use 16–17px; quick-action cards are compact and lack a capped tablet layout; icon colors are hard-coded independently of OASIS; several interactive surfaces have no explicit accessible label or expanded state; inline actions and the contact row do not declare a minimum touch height. The screen also lacks a centered content width on iPad/web.

## Design direction

Use a calm, high-trust safety experience: OASIS semantic colors (primary/info/gold/danger), 20–22px surface radii, consistent 16px page gutters, readable Arabic hierarchy, and stronger separation between help actions and emergency guidance. Keep the dark green hero as the anchor while ensuring all non-hero surfaces adapt to light/dark tokens.

## Planned changes

1. **Page rhythm and responsive width**
   - Center the scroll content and cap it at 760px on large screens.
   - Use 16px horizontal/top padding, consistent 14–16px section gaps, and retain the existing bottom navigation inset plus breathing room.
   - Keep the two quick actions side-by-side but ensure each card has `minWidth: 0` and enough height for wrapped Arabic copy.

2. **Hero and quick actions**
   - Increase hero radius to 22px, refine padding and spacing, and make the primary report action at least 48px high.
   - Enlarge quick-action icon surfaces to 48px and card targets to a comfortable minimum height; increase title/description readability.
   - Add explicit button roles and concise Arabic accessibility labels.

3. **Safety tools**
   - Normalize tool-card radius/padding/icon sizing with the rest of OASIS.
   - Add accessible names and an explicit expanded state to the accordion-like cards.
   - Raise the inline action hit area to 44px without changing its destination or toggle behavior.

4. **Emergency and policy surfaces**
   - Use semantic danger/background tokens instead of light-only fixed colors outside the dark hero.
   - Make the emergency CTA at least 50px and visually separate the important region-dependent number disclaimer.
   - Normalize policy/contact rows to 44px+ touch targets and card radius.
   - Preserve the current phone URI (911), policy URL, mailto, routes, and all behavior; no safety policy or emergency-routing logic is changed.

## Before / after

- **Before:** mixed 14/16/17px radii, 14px page padding, uncapped width, 42px quick icons, 40px tool icons, small inline actions, and fixed pale-red surfaces.
- **After:** consistent premium OASIS rhythm, 16px gutters, 760px centered content, 48px quick icons, 44px+ interactive targets, theme-aware semantic surfaces, and accessible expanded states.

## Validation plan

- Add `tests/safetyCenterDesign.test.cjs` to assert the scoped layout, theme-token usage, minimum hit targets, accessibility states, and unchanged critical route/contact links.
- GitHub CI should run the focused test and full suite automatically for the PR; run TypeScript and Expo web export where the remote workflow provides them.
- Real-device visual QA on iPhone/Android/iPad, VoiceOver/TalkBack, keyboard/safe-area behavior remains a reviewer/device requirement.

## Guardrails

No database/API changes, no route changes, no emergency-number changes, no security remediation, no other screen, game, TV, or project work. Keep the PR Draft and unmerged until required checks and review are complete.

# Business settings sheet — 2026-11-11

## Scope and priority
Following PR #105, improve only `components/market/BusinessSettingsSheet.tsx`. Preserve business save, permissions, image upload and moderation logic.

## Before
Dense single block of fields, image actions with 40px targets, no field grouping or autofill hints, keyboard may obscure actions, and modal lacks explicit safe-area handling.

## Design plan
1. Preserve OASIS palette and right-aligned Arabic text; group identity, location, and contact fields with short section labels.
2. Use minimum 44px targets for image actions, consistent 48px fields, descriptive input hints and suitable keyboard types.
3. Improve iPhone keyboard/safe-area bottom inset, scrollable content and web/iPad maximum sheet width; maintain existing close behavior.
4. Keep clear error and saving states, accessible image labels, no backend changes.

## Validation gate
Run TypeScript, web export and available tests in CI; review on iPhone, Android, iPad and desktop before merge/deploy. Do not merge or deploy without passing checks and required review.

## Next
Review business hours editor UI and schedule controls.

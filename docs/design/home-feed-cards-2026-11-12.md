# Home feed cards UX — 2026-11-12

## Plan (before implementation)
Scope: shared `TwitterInquiryCard` feed card, exclusively its compact home-feed presentation. Preserve Oasis palette and existing data/actions. Improve compact card interaction discoverability, accessibility semantics, RTL and touch sizes without backend changes.

1. Give the author and overflow actions at least 44 logical pixels of touch height/width.
2. Label bookmark/share/view interactions and expose selected bookmark state to assistive technology.
3. Make compact content title navigable and describe its destination with the post title.
4. Keep existing responsive flex wrapping, platform layout, and card state handling unchanged; inspect web and native behavior in CI.

## Before
Author-name and overflow actions lack consistent explicit accessible labels; bookmark and share actions have icon-only affordances; selected bookmark is not announced. Compact post detail target has a generic label.

## Validation gates
Run TypeScript, Web export and available tests; manual iPhone, Android, iPad and web review for Safe Area, RTL and large text. Keep PR draft, no merge/deploy before checks and approval.

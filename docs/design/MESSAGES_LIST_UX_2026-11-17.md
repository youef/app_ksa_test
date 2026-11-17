# Messages list — UX/UI plan (2026-11-17)

## Scope
`app/messages.tsx` only. Do not alter data, auth, notification or messaging behavior.

## Before / issues
- Search clear action has a 22px visual and touch target; filters are only 38px tall.
- No dedicated reset action for unread-only empty results; blank state incorrectly suggests no conversations exist.
- Conversation card content lacks `minWidth: 0`, risking long Arabic names/preview clipping on narrow phones.
- Action-sheet close and row touch areas can be undersized.
- Official conversation badge has hard-coded 22px width despite text.

## Proposed after
1. Increase search clear/filter/sheet action touch targets to >=44pt; add descriptive accessible labels and selection state.
2. Show context-aware empty copy and a reset-filters action without losing conversations.
3. Make message cards flexible for RTL, narrow screens and long names; retain 720px web/tablet max width and bottom-nav inset.
4. Replace hard-coded official unread badge sizing with content-fit pill.
5. Keep Oasis color tokens, no additional animations, and preserve existing pull-to-refresh and loading/error behaviors.

## Validation gate
Run TypeScript, web export, and available tests; inspect results and obtain required review before merge/deploy. If local execution unavailable, document exact limitation and leave PR draft.

## Next section
`app/conversation.tsx` conversation composer, message bubble density and keyboard/safe-area behavior.

## Implemented / validation
- 44pt search-clear, filters and sheet-close targets; 52pt sheet rows.
- Context-aware unread-only empty state and reset filters action.
- RTL text overflow constraints and official unread badge fitting.
- Accessible filter/retry/sheet labels.
- TypeScript, Web export and automated tests NOT RUN: local git clone failed (`Could not resolve host: github.com`), dependencies unavailable.
- Device review pending. Do not merge/deploy until tests and review pass.

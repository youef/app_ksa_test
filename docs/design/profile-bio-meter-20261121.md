# Profile Bio Character Meter — UX batch 2026-11-21

## Detailed plan (written before implementation)

### Repository state / conflict check
- Default branch: `main`, head `56e03713ceafd2b4be3ce6e30cd738007813b951`.
- Open PRs checked before choosing scope: #99 profile header, #100 profile activity tabs, #101 profile customization studio; none currently changes `components/profile/ProfileEditor.tsx` or `lib/profileEditor.ts`.
- Prior market work is active in #169 and favorites visual work in #123; this run stays in the profile area to alternate away from market and avoids both.
- Existing `ProfileEditor` already shows a plain character count for the bio, validates up to 160 Unicode characters, and has saving/dirty feedback. The count alone gives no visual sense of nearing the limit.

### Scope
- `components/profile/ProfileEditor.tsx`: only the biography field gets a compact progress meter and remaining-character state.
- `lib/profileEditor.ts`: a pure helper to count Unicode code points, clamp percentage, calculate remaining count, and flag the last 10% of the limit.
- `tests/profileEditor.test.cjs`: boundary coverage for empty, Unicode, near-limit, and over-limit helper inputs.
- `docs/design/profile-bio-meter-20261121.md`: this plan, before/after, checks, and next batch.
- No account data, validation rules, persistence, photo upload, routing, backend, other screens, or deployment changes.

### UX before / after
**Before:** bio shows `count/160` but has no visual progress or clear near-limit feedback.
**After:** a static, RTL-aware 4px meter; accessible progressbar label/value; normal theme-primary fill; warning fill and short text when at least 90% (144/160) is used; remaining count stays non-negative. The visual stays motionless to honor reduced-motion and avoid distracting live updates.

### Acceptance criteria
1. Count Unicode code points, not UTF-16 units (emoji and Arabic remain accurate).
2. Percentage never exceeds 100 and remaining never drops below 0.
3. 143/160 is normal; 144/160 enters the near-limit warning.
4. Meter is a progressbar with label, min/max/now for screen readers.
5. Works in light and dark themes via existing tokens, preserves RTL and existing field hint/errors.
6. Existing Save/Cancel, dirty state, validation and 44px action targets remain unchanged.

### Validation
- Focused Node tests for helper boundaries and UI source contract.
- TypeScript, Expo Web export and full test suite via PR checks if available.
- Manual iPhone/Android/tablet/Web and VoiceOver/TalkBack QA remains required.
- Draft only; do not merge or deploy before all checks and reviewer approval.

### Next batch
Rotate to **market**. Re-check open PRs and select an untouched, non-overlapping market component before making any edits.

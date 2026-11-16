# Directory UX refinement — 2026-11-16

## Scope and priority
`app/directory.tsx` only. Previous run addressed favorites (#123); this run addresses city directory discoverability, accessible controls and long Arabic text on small screens. No data, routing or security changes.

## Plan (before code)
1. Make the search field and clear control readable, tappable and discoverable for VoiceOver/TalkBack.
2. Ensure filter tabs announce their titles and selected state; maintain ≥44pt touch areas for chips and reset.
3. Avoid cramped card text on narrow iPhone/Android screens and improve Arabic text wrapping.
4. Provide actionable, accessible error/empty/loading states, including retry and filter reset.
5. Preserve Oasis palette, RTL layout, bottom navigation inset and responsive max width.
6. Review TypeScript, web build and available tests; leave draft PR until checks/review succeed.

## Before
Search clear button was 36pt wide; filter tabs lacked explicit labels; chips were 42pt high; retry/reset controls lacked accessibility labels; card metadata could compress beside thumbnails.

## After / verification
Pending implementation and test results.

## Next page
`app/messages.tsx` — chat list scanning, unread badges and narrow-screen layouts.

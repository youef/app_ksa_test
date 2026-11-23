# About screen UX plan — 2026-11-23

## Baseline reviewed before implementation
- `app/about.tsx` has an RTL intro, brand card, two feature rows, developer card, WhatsApp/call/email/share actions, and a bottom-nav inset.
- Several page surfaces and text colors are fixed to light-theme hex values; the intro is a 96%-width bubble with a sharp corner, and the feature icon surfaces are only 36px.
- Contact action surfaces use small vertical padding without an explicit 44px minimum; the email/share handlers silently swallow failures.
- Content is capped at 680px with 14px gutters, and section/card radii vary between 10–16px.

## Detailed design direction
1. **Theme and identity:** consume `useTheme()` palette values; keep the brand hero intentionally dark using the existing `live` token for stable white-on-dark contrast; remove light-only borders/text from page surfaces.
2. **Hierarchy:** use a centered content width (760px), 16px mobile gutters, consistent section spacing, 20–22px card radii, stronger heading levels, and clearer separation between platform introduction, features, and developer/contact information.
3. **Brand hero:** increase icon surface to 64px, use restrained translucent layers, and make the app version a compact pill with a clear label.
4. **Intro and feature rows:** replace the asymmetrical bubble with a full-width theme-aware card; increase reading size/line height; feature icon surfaces become 44px, decorative icons are hidden from assistive technology.
5. **Contact card/actions:** keep existing developer details and destinations unchanged; improve card spacing and alignment; WhatsApp CTA 52px; call/email/share secondary actions minimum 48px with accessible labels and hints.
6. **RTL and responsive behavior:** retain right-to-left content flow, use a predictable 16px gutter and 760px max width, allow text wrapping, keep phone text LTR, preserve AppHeader safe-area handling and bottom-nav inset, and rely on natural scroll rather than fixed heights.
7. **Recovery and accessibility:** provide localized feedback if email or share cannot launch; label action controls; mark decorative icons as hidden; keep press feedback subtle without introducing animation dependencies.
8. **Performance and scope:** no new packages, no data/backend/auth/navigation changes, no new motion; only the About screen, a focused static UX test, this screen's validation workflow, and design documentation.

## Acceptance and validation
- A focused Node test checks theme-aware surfaces, responsive sizing, accessibility labels, action minimums, and inset preservation.
- GitHub Actions runs the focused test, TypeScript, and Expo Web export on the PR.
- Physical iPhone/Android/iPad/web visual review and VoiceOver/TalkBack remain human QA; do not merge or deploy without green checks and review.

## Next page
`app/support.tsx` — support center overview and support-entry navigation, after reviewing open PRs for overlap.

# Platform communications release

## Administration

Open **More → Platform communication center** (`/admin-broadcast`). Access requires a non-banned `profiles.role = 'admin'` account; an email address alone never grants administration rights.

- **Automatic welcome:** edit the title/body, enable or disable delivery, and save. The database sends one welcome when a profile is created, including email-confirmation and OAuth registration. No browser, scheduler, or administrator session needs to remain open. Existing welcome text is preserved during migration; existing users are not bulk-messaged.
- **New message/update:** choose update, announcement, or system notice, select everyone, accounts created during the last seven days, or an exact username, and review the preview before publishing. `@username` is accepted. The delivery count and recent campaigns appear in the center.
- The recipient sees **منصة حيّنا** as an official conversation in Messages, Home shortcuts, and More. `/platform-inbox` shows the message history with pagination and marks only loaded messages as read. Support remains available through the support page.

The official conversation is a system inbox, not a fake personal profile. It does not accept replies or request credentials.

## Delivery and security

`profile_automatic_platform_welcome` runs after profile creation. A private receipt keyed by user ID prevents duplicates. Settings are administrator-only. The trigger function is in `app_private`, uses a fixed search path, and cannot be executed by client roles.

`send_platform_campaign` checks the authenticated administrator on the server, validates the payload, excludes banned recipients, and inserts the entire audience in one database transaction. It does not depend on the Data API's profile-list row limit. The request UUID protects retries after an uncertain network response from duplicating delivery. A unique campaign/recipient index adds a second safeguard.

Inbox RLS restricts ordinary accounts to their own messages. Column privileges permit recipients to update `read`, never the official text, recipient, or sender. Realtime is enabled for the inbox; RLS still controls event visibility. Authenticated access to the campaign function is intentional: its explicit administrator check is tested. Private receipt RLS intentionally has no client policies or grants.

Migration `20261025144106_automatic_platform_welcome.sql` matches the version applied to the linked `hayna` project. It bootstraps the original inbox because a legacy migration is dated after the server clock. The legacy inbox migration is now repeatable and preserves read-only message content privileges.

## Community UI

- Home has compact, accessible shortcuts to posting, the market, live streams, and official news, respecting platform feature flags.
- More supports searching service/settings labels, includes the official inbox and communication center, hides disabled discovery modules, and only shows logout for signed-in accounts.
- Live discovery searches Arabic titles, host names/handles, categories, and cities. It sorts by audience or start time, includes a single stream in trends, and resets empty-result filters. Grid columns adapt to the actual container width. Live refreshes are debounced, focus-scoped, and protected against stale responses.

## Verification

- `node --test tests/*.test.cjs`: 15 passing tests, including Arabic live search/sorting and the existing story publishing, visibility, and persistence tests. The story publisher mock now returns IDs using the existing production `.insert().select()` contract.
- `npm run typecheck`: passes.
- `tests/platformWelcome.integration.sql`: ran successfully against the linked database. It verifies welcome delivery, disablement, duplicate prevention, recipient isolation, content-edit/impersonation rejection, administrator authorization, exact-handle delivery, and idempotent retries. All test users and messages roll back.
- Browser checks: Home shortcuts, official inbox and existing welcome, admin settings, unsent campaign preview and audience choices, More search, and live discovery controls.
- Web and iOS JavaScript exports are checked before release. An iOS export is not an App Store binary or a physical-device test. No active public live stream was available for audiovisual testing.

Database advisors still report pre-existing platform findings outside this release. This release does not claim to resolve every existing database advisory.

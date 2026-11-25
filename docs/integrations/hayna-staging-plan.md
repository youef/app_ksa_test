# Hayna integrations — staging only

Project: https://github.com/youef/app_ksa_test
Vercel: app_ksa_test / appksatest.vercel.app
Supabase: hayna (vkeuyompnddqfvulalkk)
Linear: https://linear.app/hyanaapp/project/hyna-hayna-platform-55bf97a51f74

## Rules
- No production changes, migrations, deployments, or secret disclosure without review.
- All integrations first run on a dedicated branch and preview environment.
- Use Context7 to verify SDK APIs before implementing.
- Never expose Supabase service role, Vercel, Temporal or PostHog private keys to the client.
- Analytics must not capture phone numbers, emails, chat text, precise coordinates or other personal data.

## Integration checklist
- [x] Verify GitHub repository and Vercel project.
- [x] Confirm Vercel EXPO_PUBLIC_SUPABASE_URL points to hayna.
- [x] Create Linear project and work items HYA-5 through HYA-10.
- [x] Locate Canva Hayna designs; no automatic exports enabled.
- [ ] Add PostHog SDK to Expo web/native, gated by environment and privacy consent.
- [ ] Configure Vercel preview environment and test event ingestion.
- [ ] Add PR CI typecheck/build checks after assessing existing workflows.
- [ ] Link reviewed Figma/Canva assets through a PR.
- [ ] Deploy Temporal worker to a dedicated staging host; configure retries, idempotency, monitoring.
- [ ] Activate recurring monitoring after schedule and permissions are approved.

## PostHog
Existing connected analytics project is named 'Default project' and has no ingested events at time of review. Do not assume it is production analytics. Use EXPO_PUBLIC_POSTHOG_KEY and EXPO_PUBLIC_POSTHOG_HOST environment variables; never commit actual values.

## Temporal
Temporal is a separate durable workflow service, not a ChatGPT plugin. Requires a Temporal Cloud namespace or self-hosted server and a long-running worker. Do not run a worker in Vercel request handlers.

## Design sources
Canva designs found: DAHYl0gSUzo (welcome mobile), DAHYZ8NrjQk (icon), DAHYZ9f-S2w (identity). Verify design approval and licensing before export.

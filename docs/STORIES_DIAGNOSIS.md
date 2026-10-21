# Stories discovery diagnosis — 2026-10-21

Production at investigation: 0a7a34b, Vercel READY, alias appksatest.vercel.app.
Read-only production queries found 69 stored stories, 5 active. All 5 active authors' profiles have city عرعر and a null district. Three are public stories from a public account; two belong to a private account (one public audience, one followers audience). Expired stories remain excluded.

A rolled-back transaction tested actual authenticated RLS reads for all 6 Arar profiles, using their subject IDs locally in SQL. Each could read between 3 and 5 active city stories. No profile, story, follow, or privacy data was changed. SELECT permissions and the author/profile foreign key work.

The restored interfaces had different discovery behavior. Exact district filtering excluded the current active stories because author districts were null; filtering all fetched stories by city also removed followed authors outside that city. Sections were conditionally unmounted when empty, and query errors were logged as empty results.

The fix restores the two-section layout from 0b1b888: neighborhood/followed story rings immediately below the header, city trending below. Shared discovery membership includes own/followed/exact-neighborhood authors in rings and independently includes same-city authors in trending. A missing author district never prevents city trending. Missing city can use the existing selected city but never exposes all cities. Private/hidden/blocked audience checks remain enforced by RLS; mute preferences remain respected. The sections stay visible when empty, with retry for query failures. Returning from publishing reloads stories through useFocusEffect. Home rings use the same membership helper.

Verification: regression tests cover null districts, own stories, followed authors in another city, city isolation, and missing city. TypeScript and Expo web export are checked for this release. An authenticated browser session was unavailable, so signed-in visual interaction is not claimed.

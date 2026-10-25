# Hayna Oasis — design library

Final assets: `public/design-system/hayna-v1/`.
Review: http://localhost:8081/design-system/hayna-v1/index.html
Package: `Hayna-Oasis-v1.zip`.

621 logical assets and mockups, 1830 PNG files including density variants and the overview. Read GUIDE.md and manifest.json for sizing and usage. validation.json records the checks.

Sources: build.cjs generates exact UI geometry and PNG exports. finalize.cjs composes the illustrative screen examples using the final assets. pack.cjs validates dimensions, includes sources, and creates the ZIP. Run from the repository root with sharp, @napi-rs/canvas and fflate on NODE_PATH. The current project's Lucide package supplies icon source data; its ISC license is included. Preserve the two final artwork PNGs when rebuilding; generated originals are not required if these copies exist.

The PNG design library is prepared for review. Existing application screens are not migrated by these scripts. Draft image explorations are excluded from the final assets and ZIP.

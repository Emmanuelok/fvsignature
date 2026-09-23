# Frederick & Veronica

A complete wedding website for **Frederick Amokohene and Veronica Owusu**, built with Next.js, React, and Tailwind CSS.

**Saturday, October 10, 2026 · 12:00 noon (America/St_Johns)**

St. James United Church, 330 Elizabeth Ave, St. John's, NL A1B 1T9.

## Included

- A responsive photographic homepage with Home, Our Story, The Day, Venue, Guestbook, and RSVP sections, plus a separate gallery at `/gallery`.
- Enhanced venue photograph, interactive map, directions, address copying, countdown, and calendar download.
- Four curated portraits, one from each similar pair, in an editorial gallery with cinematic transitions, a full-screen slideshow, favourites, and individual or collection downloads.
- A mobile-friendly RSVP with review before submission, field-level validation, retry-safe private storage, party size, children, dietary requirements, and access needs.
- Private guestbook and a protected organizer workspace at `/manage`, including guest search, attendance corrections, CSV export, and event editing.
- Confirmed guest guidance, October 5 RSVP deadline, a small gift of thanks after the service, dress colours, parking, and contact links.

## Password-free organizer and RSVP backend

The original wedding Site holds the existing database and supports ChatGPT organizer sign-in. The Vercel `/manage` link redirects there. Guest submissions have a separate activation switch that remains off until owner enrollment is complete and the backend's audience change is approved. Follow [the backend activation checklist](docs/backend-activation.md) before enabling it. The website continues to deploy from GitHub to Vercel.

## Legacy Vercel database deployment

The direct Neon integration is retained for installations that use Vercel-managed database credentials instead of the original wedding backend:

Set both switches in `lib/backend-config.ts` to `false` when using this legacy integration.

1. Import `Emmanuelok/fvsignature` into Vercel. Select **Next.js**, repository root, and **Node.js 22.x**. The production branch is `main`.
2. Connect a dedicated **Neon PostgreSQL** database from Vercel's Storage/Marketplace. The application accepts `DATABASE_URL` or `POSTGRES_URL`. Keep preview data in a separate database/branch from production.
3. Set `ORGANIZER_PASSWORD_HASH` and `SESSION_SECRET` as server-side environment variables. Never prefix them with `NEXT_PUBLIC_` or commit them.
4. Pull the intended database environment into `.env.local` and run `pnpm db:migrate` once before opening the RSVP form to guests. The migration is idempotent.
5. Deploy the GitHub `main` branch. Subsequent pushes deploy automatically through Vercel's Git integration.

No environment credentials or guest records are included in this repository. Missing database credentials cause forms to report an error rather than pretend a response was saved. Organizer access remains disabled until its required environment variables are set.

## Development

```sh
corepack enable
pnpm install --frozen-lockfile
# Copy .env.example to .env.local and add your development-only credentials.
pnpm db:migrate
pnpm dev
```

```sh
pnpm typecheck
pnpm test
pnpm build
```

## See who has replied

Open **https://fvsignature.com/manage** (or select **Organizer** in the footer) to continue to the original wedding Site and sign in with ChatGPT. The owner must first complete the enrollment described in the activation checklist. The guest list shows responses newest first, attendance totals, children, contact details, other guest names, dietary requirements, access needs, and notes. Use **Refresh responses** to load new replies, search or filter attendance, and export all active responses as CSV. Expand a response to correct its attendance or party size, or archive a duplicate. Archived entries remain available in the archive filter.

The guest receives an on-screen confirmation and a downloadable receipt only after the database confirms the save. Confirmation emails are not sent. A failed request preserves the guest's details while the page stays open; retrying the same submission cannot create another record. Changing or removing an existing response requires the organizer.

Publishing the form alone does not activate storage. The organizer redirect and public guest API connection are controlled separately; see the activation checklist for their current settings.

## Check RSVP storage

`GET /api/rsvp` is a no-cache availability check. It returns only `{"available":true}` when the expected RSVP columns can be queried, or HTTP 503 with `{"available":false}`. It never lists guests. Vercel runtime logs record `rsvp_storage_failed` with a safe category and a request ID, never guest details or database credentials.

- `database_not_configured`: connect the project's Neon database and set `DATABASE_URL` or `POSTGRES_URL` for Production.
- `table_missing` / `column_missing`: pull that environment privately, then run `pnpm db:migrate`. The additive upgrade preserves existing responses.
- `database_authentication` / `database_unreachable` / `database_unavailable`: check the database connection and provider status privately.

After configuring credentials, deploy again so the server functions receive the new environment. Verify an RSVP can be saved and is visible after signing into `/manage`; remove or archive only clearly identified test records. Automated tests exercise validation, persistence failures, and retry handling with a test database double, not the production database.

## Legacy organizer credentials

Run `pnpm organizer:password` in a private terminal and follow the hidden password prompt. Save its generated hash as `ORGANIZER_PASSWORD_HASH` in Vercel. Generate a separate session secret with `openssl rand -hex 32` and save it as `SESSION_SECRET`.

Organizer sessions use signed, expiring, HttpOnly cookies. Password checks use scrypt and a persistent login-attempt limiter. The original hosting platform's identity headers are never trusted on Vercel.

## Data and migration

`migrations/001_initial.sql` defines the PostgreSQL tables used on Vercel. The `drizzle/` directory preserves the historical SQLite migrations from the original website; do not run those against PostgreSQL. Existing hosting data must be migrated privately, not committed to this public repository.

The enhanced church photo is based on the supplied photograph. Small details reconstructed from its low-resolution source may differ from the original.

## Large assets

The venue PNG and collection ZIP are stored byte-for-byte in `assets/packed/` to keep individual repository uploads small. `pnpm dev` and `pnpm build` reconstruct the original public files automatically and verify their SHA-256 checksums. No image quality is lost. Run `pnpm assets:prepare` if you need those two files before building.

The displayed gallery and its four-photo download share the selection in `lib/gallery-photos.json`. The build creates `public/Frederick-Veronica-Selected-Photographs.zip` from those original WebP files. The original eight photographs remain available as source assets.

# Wedding backend activation

The public invitation stays at `https://fvsignature.com` on Vercel. The original wedding Site at `https://frederick-and-veronica.elkings.chatgpt.site` supplies the existing database and ChatGPT organizer sign-in. No Vercel password or database secret is required by this connection.

## Current switches

`lib/backend-config.ts` keeps organizer access separate from guest submission activation:

- `WEDDING_ORGANIZER_BACKEND_ENABLED = true`: `/manage` redirects to the original Site's protected organizer page. The former Vercel password login and organizer mutation endpoints are disabled.
- `WEDDING_GUEST_BACKEND_ENABLED = false`: guest submissions and wedding settings keep their existing Vercel behavior until the backend is ready and the audience change is approved. Setting the organizer switch does not activate RSVP storage.

## Activate in this order

1. Confirm the original Site still has an **owner-only** audience. Deploy its protected organizer and public API code without broadening that audience.
2. With `ORGANIZER_ENROLLMENT_ENABLED=owner-private` and `ORGANIZER_ENROLLMENT_EMAIL` set to the confirmed owner’s email on the Site, the owner opens the organizer link and signs in with ChatGPT. The protected enrollment screen submits `POST /api/organizer/enroll` to bind that authenticated Site identity to organizer access. Do not enroll a guest or use identity values copied from the browser.
3. Confirm the enrolled owner can view the organizer workspace. Remove both `ORGANIZER_ENROLLMENT_ENABLED` and `ORGANIZER_ENROLLMENT_EMAIL`, then redeploy the Site **before** making it public. Confirm the enrollment endpoint returns 403. Confirm unauthenticated users and other signed-in identities cannot read guest responses, edit event details, or enroll.
4. Obtain approval for the Site audience change. Keep organizer authorization enforced in application code; public Site access must expose only guest submissions, availability, and public wedding details.
5. After the approved audience change, confirm anonymous `GET /api/rsvp` returns only `{"available":true}` and `GET /api/event` returns `{"event":{...}}`. The guest-write endpoints must return JSON; a sign-in page or redirect is unavailable, never a successful submission.
6. Set `WEDDING_GUEST_BACKEND_ENABLED = true`, run `pnpm test`, `pnpm typecheck`, and `pnpm build`, then push the reviewed code to GitHub for Vercel deployment.
7. Submit one clearly identified test RSVP from the public site, verify it appears in the protected organizer workspace, and archive that test response. Confirm retrying the same submission creates no duplicate.

The Vercel proxy has a fixed backend origin and only calls `/api/rsvp`, `/api/wishes`, and `/api/event`. It does not forward cookies, authorization, ChatGPT identity headers, arbitrary paths, or upstream response headers. `/api/rsvp` never returns guest records. Native HTML forms return to the confirmation page on the Vercel site only after the backend confirms a save.

If an upstream request fails, times out, returns HTML, or gives an invalid confirmation, the public form reports that the save is unconfirmed and preserves its retry ID. Event details use the confirmed local defaults when the backend is unavailable. Switching guest access back off restores the former Vercel database adapter; it does not copy or remove data from either database.

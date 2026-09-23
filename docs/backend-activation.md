# Wedding backend activation

The public invitation stays at `https://fvsignature.com` on Vercel. The original wedding Site at `https://frederick-and-veronica.elkings.chatgpt.site` supplies the existing database and ChatGPT organizer sign-in. No Vercel password or database secret is required by this connection.

## Current switches

`lib/backend-config.ts` keeps organizer access separate from guest submission activation:

- `WEDDING_ORGANIZER_BACKEND_ENABLED = true`: `/manage` redirects to the original Site's protected organizer page. The former Vercel password login and organizer mutation endpoints are disabled.
- `WEDDING_GUEST_BACKEND_ENABLED = true`: RSVP submissions, guestbook submissions, and public wedding settings use the original Site's public APIs. This switch does not grant organizer access or expose guest records.

The owner is enrolled. Both one-time enrollment environment flags have been removed and the protected backend was redeployed privately as revision 3. On September 23, 2026, the owner explicitly approved public RSVP submissions. The source configuration now enables that connection. This records the approved configuration, not a completed production submission test; the audience change, Vercel deployment, and live checks below must still be verified.

## Completed private setup

The protected organizer and public API code were deployed while the Site had an owner-only audience. The owner signed in with ChatGPT and enrolled that authenticated Site identity through `POST /api/organizer/enroll`. Both `ORGANIZER_ENROLLMENT_ENABLED` and `ORGANIZER_ENROLLMENT_EMAIL` were then removed, followed by private deployment revision 3. Keep enrollment disabled after making guest submission routes public; never enroll a guest or use identity values copied from the browser.

## Deployment and verification checklist

1. Apply the owner-approved Site audience change. Keep organizer authorization enforced in application code; public Site access must expose only guest submissions, availability, and public wedding details. Approval was given on September 23, 2026.
2. Confirm the enrollment endpoint returns 403. Confirm unauthenticated users and other signed-in identities cannot read guest responses, edit event details, or enroll.
3. Confirm anonymous `GET /api/rsvp` returns only `{"available":true}` and `GET /api/event` returns `{"event":{...}}`. The guest-write endpoints must return JSON; a sign-in page or redirect is unavailable, never a successful submission.
4. With `WEDDING_GUEST_BACKEND_ENABLED = true`, run `pnpm test`, `pnpm typecheck`, and `pnpm build`, then push the reviewed code to GitHub for Vercel deployment.
5. Submit one clearly identified test RSVP from the public site, verify it appears in the protected organizer workspace, and archive that test response. Confirm retrying the same submission creates no duplicate.

The Vercel proxy has a fixed backend origin and only calls `/api/rsvp`, `/api/wishes`, and `/api/event`. It does not forward cookies, authorization, ChatGPT identity headers, arbitrary paths, or upstream response headers. `/api/rsvp` never returns guest records. Native HTML forms return to the confirmation page on the Vercel site only after the backend confirms a save.

If an upstream request fails, times out, returns HTML, or gives an invalid confirmation, the public form reports that the save is unconfirmed and preserves its retry ID. Event details use the confirmed local defaults when the backend is unavailable. Switching guest access back off restores the former Vercel database adapter; it does not copy or remove data from either database.

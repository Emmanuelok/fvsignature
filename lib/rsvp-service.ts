/** RSVP handling is independent of the HTTP database driver so failure paths can be tested. */
export type RsvpData = {
  id: string; name: string; email: string; attendance: string; guests: number; children: number;
  guestNames: string; dietary: string; song: string; note: string; accessNeeds: string;
};
export type RsvpDatabase = {
  prepare(query: string): {
    bind(...values: unknown[]): { first<T>(): Promise<T | null> };
    first<T>(): Promise<T | null>;
  };
};
const noStore = {'Cache-Control': 'no-store, max-age=0'};
const reference = (id: string) => `FV-${id.slice(0, 8).toUpperCase()}`;

export function validateRsvp(body: unknown, fallbackId: string) {
  const errors: Record<string, string> = {};
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {errors: {form: 'Please check your response.'}};
  const b = body as Record<string, unknown>;
  if (b.website) return {errors: {form: 'Please check your response.'}};
  const str = (key: string) => typeof b[key] === 'string' ? b[key].trim() : '';
  const attendance = str('attendance');
  const attending = attendance === 'attending';
  const count = (value: unknown) => (typeof value === 'string' && /^\d+$/.test(value)) || typeof value === 'number' ? Number(value) : NaN;
  const data: RsvpData = {
    id: str('id') || fallbackId, name: str('name'), email: str('email').toLowerCase(), attendance,
    guests: attending ? count(b.guests) : 0, children: attending ? count(b.children ?? '0') : 0,
    guestNames: attending ? str('guestNames') : '', dietary: attending ? str('dietary') : '',
    accessNeeds: attending ? str('accessNeeds') : '', song: str('song'), note: str('note'),
  };
  if (!/^[a-f0-9]{32}$/.test(data.id)) errors.form = 'Please refresh the page and try again.';
  if (data.name.length < 2 || data.name.length > 100) errors.name = 'Enter your full name (2–100 characters).';
  if (data.email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.email = 'Enter a valid email address.';
  if (!['attending', 'declined'].includes(attendance)) errors.attendance = 'Choose whether you will attend.';
  if (attending && (!Number.isInteger(data.guests) || data.guests < 1 || data.guests > 10)) errors.guests = 'Choose a party size from 1 to 10, including yourself and children.';
  if (attending && (!Number.isInteger(data.children) || data.children < 0 || data.children > data.guests)) errors.children = 'Children must be included in your total party size.';
  if (attending && data.guests > 1 && data.guestNames.length < 2) errors.guestNames = 'Please name the other guests, including children.';
  for (const [key, max] of [['guestNames', 600], ['dietary', 600], ['accessNeeds', 1000], ['song', 180], ['note', 1000]] as const) {
    if (data[key].length > max) errors[key] = `Please use ${max} characters or fewer.`;
  }
  return Object.keys(errors).length ? {errors} : {data, errors};
}

export function storageFailureCode(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  const codes: Record<string, string> = {
    FV_DATABASE_MISSING: 'database_not_configured', '42P01': 'table_missing', '42703': 'column_missing',
    '28P01': 'database_authentication', '3D000': 'database_missing', '53300': 'database_busy',
    '57014': 'database_timeout', ECONNREFUSED: 'database_unreachable', ETIMEDOUT: 'database_timeout',
  };
  return codes[code] || 'database_unavailable';
}

export function createRsvpHandlers(deps: {
  database: () => RsvpDatabase;
  read: (request: Request) => Promise<{body: unknown; form: boolean}>;
  id: () => string;
  log: (code: string, requestId: string) => void;
}) {
  function reply(body: Record<string, unknown>, status: number, form = false) {
    if (!form) return Response.json(body, {status, headers: noStore});
    // No guest data or provider errors are reflected into the fallback page.
    const message = status === 503 ? 'We could not confirm your RSVP was saved. Please go back to retry, or contact Ibrahim at +1 (709) 853-5838.' : 'Please go back and check your name, email, attendance and party details, then try again.';
    return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RSVP — Frederick & Veronica</title><body style="font:18px/1.6 system-ui;max-width:640px;margin:10vh auto;padding:24px"><h1>Your RSVP needs another moment.</h1><p>${message}</p><p><a href="/rsvp">Return to RSVP</a> · <a href="tel:+17098535838">Call Ibrahim</a></p></body></html>`, {status, headers: {...noStore, 'Content-Type': 'text/html; charset=utf-8'}});
  }
  async function GET() {
    try {
      await deps.database().prepare('SELECT id,name,email,attendance,guests,children,access_needs,guest_names,dietary,song,note,created_at FROM rsvps WHERE FALSE').first();
      return Response.json({available: true}, {headers: noStore});
    } catch (error) {
      deps.log(storageFailureCode(error), deps.id());
      return Response.json({available: false}, {status: 503, headers: noStore});
    }
  }
  async function POST(request: Request) {
    let form = false;
    try {
      const origin = request.headers.get('origin');
      if (request.headers.get('sec-fetch-site') === 'cross-site' || (origin && new URL(origin).origin !== new URL(request.url).origin)) return reply({error: 'Please respond from this website.'}, 403);
    } catch { return reply({error: 'Please respond from this website.'}, 403); }
    let parsed;
    try { parsed = await deps.read(request); form = parsed.form; }
    catch { return reply({error: 'Please check your response.'}, 400); }
    const result = validateRsvp(parsed.body, deps.id());
    if (!result.data) return reply({error: 'Please check the highlighted details.', fieldErrors: result.errors}, 400, form);
    const d = result.data;
    const requestId = deps.id();
    try {
      const db = deps.database();
      const saved = await db.prepare(`INSERT INTO rsvps (id,name,email,attendance,guests,children,access_needs,guest_names,dietary,song,note,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT (id) DO NOTHING RETURNING id`)
        .bind(d.id,d.name,d.email,d.attendance,d.guests,d.children,d.accessNeeds,d.guestNames,d.dietary,d.song,d.note,Date.now()).first<{id: string}>();
      if (!saved) {
        // A retry can confirm the same response, but can never overwrite another record.
        const old = await db.prepare('SELECT name,email,attendance,guests,children,access_needs,guest_names,dietary,song,note FROM rsvps WHERE id=?').bind(d.id).first<Record<string, unknown>>();
        const expected = {name:d.name,email:d.email,attendance:d.attendance,guests:d.guests,children:d.children,access_needs:d.accessNeeds,guest_names:d.guestNames,dietary:d.dietary,song:d.song,note:d.note};
        if (!old || Object.entries(expected).some(([key,value]) => old[key] !== value)) return reply({error: 'This response has already been saved with different details. Please contact Ibrahim if you need to change it.', code: 'response_conflict'}, 409, form);
      }
      if (form) return new Response(null, {status: 303, headers: {...noStore, Location: new URL(`/thanks?kind=rsvp&ref=${reference(d.id)}`, request.url).toString()}});
      return reply({success: true, reference: reference(d.id)}, saved ? 201 : 200);
    } catch (error) {
      deps.log(storageFailureCode(error), requestId);
      return reply({error: 'We could not confirm your RSVP was saved. Please try again. If the problem continues, contact Ibrahim so we can record your response.', code: 'storage_unavailable', requestId}, 503, form);
    }
  }
  return {GET, POST};
}

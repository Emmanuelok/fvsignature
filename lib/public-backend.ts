import type {WeddingEvent} from './event-types';

export const weddingBackendOrigin = 'https://frederick-and-veronica.elkings.chatgpt.site';
export const weddingOrganizerUrl = `${weddingBackendOrigin}/manage`;
const noStore = {'Cache-Control': 'no-store, max-age=0'};
type PublicWrite = 'rsvp' | 'wishes';
type JsonObject = Record<string, unknown>;
const fields = new Set(['form', 'name', 'email', 'attendance', 'guests', 'children', 'guestNames', 'dietary', 'accessNeeds', 'song', 'note']);

function object(value: unknown): value is JsonObject {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

async function boundedText(message: Request | Response, limit: number): Promise<string> {
  if (Number(message.headers.get('content-length')) > limit) {
    void message.body?.cancel().catch(() => {});
    throw new Error('Body too large');
  }
  if (!message.body) return '';
  const reader = message.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        void reader.cancel().catch(() => {});
        throw new Error('Body too large');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder('utf-8', {fatal: true}).decode(bytes);
}

function sameOrigin(request: Request): boolean {
  try {
    const origin = request.headers.get('origin');
    return request.headers.get('sec-fetch-site') !== 'cross-site'
      && (!origin || new URL(origin).origin === new URL(request.url).origin);
  } catch { return false; }
}

function failure(kind: PublicWrite, status = 503, form = false, details: JsonObject = {}): Response {
  const messages: Record<number, string> = {
    400: 'Please check the highlighted details and try again.',
    403: 'Please send your response from this website.',
    409: 'This response has already been saved with different details. Please contact Ibrahim if you need to change it.',
    429: 'Please wait a moment before trying again.',
    503: kind === 'rsvp'
      ? 'We could not confirm your RSVP was saved. Please try again. If the problem continues, contact Ibrahim so we can record your response.'
      : 'Your wish could not be saved just now. Your words are still here—please try again.',
  };
  const message = messages[status] || messages[503];
  if (form) {
    return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Frederick & Veronica</title><body style="font:18px/1.6 system-ui;max-width:640px;margin:10vh auto;padding:24px"><h1>Your response needs another moment.</h1><p>${message}</p><p><a href="/${kind === 'rsvp' ? 'rsvp' : 'guestbook'}">Return to the form</a> · <a href="tel:+17098535838">Call Ibrahim</a></p></body></html>`, {status, headers: {...noStore, 'Content-Type': 'text/html; charset=utf-8'}});
  }
  return Response.json({error: message, ...details}, {status, headers: noStore});
}

/** Only the three public guest endpoints are reachable; this never forwards
 * cookies, authorization, user identity, arbitrary paths, or upstream headers. */
export function createPublicBackendClient(options: {fetch?: typeof fetch; timeoutMs?: number} = {}) {
  const send = options.fetch || fetch;
  const timeoutMs = options.timeoutMs ?? 8000;

  async function upstream(path: '/api/rsvp' | '/api/wishes' | '/api/event', body?: JsonObject) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await send(`${weddingBackendOrigin}${path}`, {
        method: body ? 'POST' : 'GET',
        headers: body
          ? {'Accept': 'application/json', 'Content-Type': 'application/json'}
          : {'Accept': 'application/json'},
        body: body ? JSON.stringify(body) : undefined,
        cache: 'no-store', credentials: 'omit', redirect: 'error', signal: controller.signal,
      });
      // A private Site may answer with a sign-in page. HTML is never a saved RSVP.
      if (!/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') || '')) {
        void response.body?.cancel().catch(() => {});
        throw new Error('Expected JSON');
      }
      const data: unknown = JSON.parse(await boundedText(response, 16384));
      if (!object(data)) throw new Error('Expected JSON object');
      return {status: response.status, data};
    } finally { clearTimeout(timeout); }
  }

  async function getRsvpAvailability(): Promise<Response> {
    try {
      const result = await upstream('/api/rsvp');
      if (result.status === 200 && result.data.available === true) return Response.json({available: true}, {headers: noStore});
    } catch { /* Availability remains false until the public backend responds. */ }
    return Response.json({available: false}, {status: 503, headers: noStore});
  }

  async function submit(request: Request, kind: PublicWrite): Promise<Response> {
    if (!sameOrigin(request)) return failure(kind, 403);
    const type = request.headers.get('content-type') || '';
    const form = /^application\/x-www-form-urlencoded(?:\s*;|$)/i.test(type);
    if (!form && !/^application\/json(?:\s*;|$)/i.test(type)) return failure(kind, 400);
    let body: unknown;
    try {
      const raw = await boundedText(request, kind === 'rsvp' ? 12000 : 8000);
      body = form ? Object.fromEntries(new URLSearchParams(raw)) : JSON.parse(raw);
    } catch { return failure(kind, 400, form); }
    if (!object(body)) return failure(kind, 400, form);
    // Native wish forms previously generated this UUID on the server. Keep that
    // behavior when encoding a form as JSON for the public backend.
    if (form && kind === 'wishes' && !body.id) body.id = crypto.randomUUID();
    try {
      const result = await upstream(kind === 'rsvp' ? '/api/rsvp' : '/api/wishes', body);
      if (result.status === 200 || result.status === 201) {
        if (result.data.success !== true) return failure(kind, 503, form);
        const reference = result.data.reference;
        if (kind === 'rsvp' && (typeof reference !== 'string' || !/^FV-[A-F0-9]{8}$/.test(reference)
          || (typeof body.id === 'string' && /^[a-f0-9]{32}$/.test(body.id) && reference !== `FV-${body.id.slice(0, 8).toUpperCase()}`))) return failure(kind, 503, form);
        if (form) {
          const destination = kind === 'rsvp' ? `/thanks?kind=rsvp&ref=${reference}` : '/thanks?kind=wish';
          return new Response(null, {status: 303, headers: {...noStore, Location: new URL(destination, request.url).toString()}});
        }
        return Response.json(kind === 'rsvp' ? {success: true, reference} : {success: true}, {status: result.status, headers: noStore});
      }
      if ([400, 403, 409, 429].includes(result.status)) {
        const details: JsonObject = {};
        if (result.status === 409) details.code = 'response_conflict';
        if (result.status === 400 && object(result.data.fieldErrors)) {
          details.fieldErrors = Object.fromEntries(Object.entries(result.data.fieldErrors).filter(([key, value]) => fields.has(key) && typeof value === 'string' && value.length <= 200));
        }
        return failure(kind, result.status, form, details);
      }
    } catch { /* Do not leak provider errors or claim an uncertain save succeeded. */ }
    return failure(kind, 503, form, {code: 'storage_unavailable'});
  }

  async function getEvent(): Promise<WeddingEvent | null> {
    try {
      const {status, data} = await upstream('/api/event');
      const e = data.event;
      if (status !== 200 || !object(e)) return null;
      const limits = {date: 10, time: 5, venue: 200, address: 400, timezone: 100, dressCode: 200, note: 1000} as const;
      if (Object.entries(limits).some(([key, length]) => typeof e[key] !== 'string' || e[key].length > length)) return null;
      const event = Object.fromEntries(Object.keys(limits).map(key => [key, e[key]])) as WeddingEvent;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(event.date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(event.time)) return null;
      const date = new Date(`${event.date}T12:00:00Z`);
      if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== event.date) return null;
      new Intl.DateTimeFormat('en', {timeZone: event.timezone});
      return event;
    } catch { return null; }
  }

  return {
    getRsvpAvailability,
    submitRsvp: (request: Request) => submit(request, 'rsvp'),
    submitWish: (request: Request) => submit(request, 'wishes'),
    getEvent,
  };
}

export const publicWeddingBackend = createPublicBackendClient();

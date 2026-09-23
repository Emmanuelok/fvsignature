'use client';

import {useState, useTransition, type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {ArrowUpRight, CalendarDays, Check, ChevronDown, Download, Heart, LoaderCircle, RefreshCw, Search, Users} from 'lucide-react';
import {type WeddingEvent} from '@/lib/event-types';
import './workspace.css';

type Rsvp = {
  id: string;
  name: string;
  email: string;
  attendance: string;
  guests: number;
  children: number;
  access_needs: string;
  guest_names: string;
  dietary: string;
  song: string;
  note: string;
  created_at: number;
};
type Wish = {id: string; name: string; message: string; created_at: number};
type AttendanceFilter = 'active' | 'attending' | 'declined' | 'archived';
const filters: {value: AttendanceFilter; label: string}[] = [
  {value: 'active', label: 'All responses'},
  {value: 'attending', label: 'Attending'},
  {value: 'declined', label: 'Declined'},
  {value: 'archived', label: 'Archived'},
];
const receivedFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/St_Johns', year: 'numeric', month: 'short', day: 'numeric',
  hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
});
const reference = (id: string) => `FV-${id.slice(0, 8).toUpperCase()}`;
const receivedAt = (value: number) => Number.isFinite(Number(value)) && !Number.isNaN(new Date(Number(value)).getTime())
  ? receivedFormatter.format(Number(value)) : 'Date unavailable';

async function saveOrganizerDetails(data: Record<string, unknown>) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch('/api/organizer', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(data), signal: controller.signal,
    });
    const body = await response.json().catch(() => ({})) as {error?: string};
    if (!response.ok) throw new Error(body.error || 'Your changes could not be saved. Please try again.');
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('The connection timed out. Please refresh to check whether your changes were saved.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function Organizer({event, rsvps: initialRsvps, wishes}: {event: WeddingEvent; rsvps: Rsvp[]; wishes: Wish[]}) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const [snapshot, setSnapshot] = useState(initialRsvps);
  const [rsvps, setRsvps] = useState(initialRsvps);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<AttendanceFilter>('active');
  const [refreshFrom, setRefreshFrom] = useState<Rsvp[] | null>(null);

  // A server refresh supplies a new snapshot; retain optimistic corrections until then.
  if (snapshot !== initialRsvps) {
    setSnapshot(initialRsvps);
    setRsvps(initialRsvps);
  }

  const active = rsvps.filter(response => response.attendance !== 'archived');
  const attending = active.filter(response => response.attendance === 'attending');
  const declined = active.filter(response => response.attendance === 'declined');
  const attendingGuests = attending.reduce((total, response) => total + Number(response.guests), 0);
  const attendingChildren = attending.reduce((total, response) => total + Number(response.children || 0), 0);
  const search = query.trim().toLocaleLowerCase();
  const filtered = rsvps.filter(response => {
    const matchesStatus = filter === 'active' ? response.attendance !== 'archived' : response.attendance === filter;
    return matchesStatus && [response.name, response.email, response.guest_names, reference(response.id)]
      .join(' ').toLocaleLowerCase().includes(search);
  });

  function refresh() {
    setRefreshFrom(snapshot);
    startTransition(() => router.refresh());
  }

  function exportCsv() {
    const rows = [
      ['Reference', 'Name', 'Email', 'Attendance', 'Party size (including children)', 'Children', 'Access needs', 'Other guests', 'Dietary', 'Song', 'Note', 'Received (Newfoundland time)'],
      ...active.map(response => [
        reference(response.id), response.name, response.email, response.attendance,
        String(response.guests), String(response.children || 0), response.access_needs || '',
        response.guest_names || '', response.dietary || '', response.song || '', response.note || '',
        receivedAt(response.created_at),
      ]),
    ];
    const cell = (value: string) => {
      // Quoting alone does not stop spreadsheet formulas; prefix risky cells as text.
      const safe = /^[\t\r\n]/.test(value) || /^\s*[=+@-]/.test(value) ? `'${value}` : value;
      return `"${safe.replaceAll('"', '""')}"`;
    };
    const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n')], {type: 'text/csv;charset=utf-8'}));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Frederick-Veronica-Guest-List.csv';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  return <main className="organizer-main organizer-dashboard">
    <header className="organizer-dashboard-header">
      <div><span className="eyebrow">FREDERICK & VERONICA · PRIVATE ORGANIZER</span><h1>Every guest, welcomed.</h1><p>See who has replied, plan your seating, and keep everyone’s needs close at hand.</p></div>
      <div className="organizer-header-actions"><Link className="button button-burgundy" href="/">View wedding website <ArrowUpRight size={18}/></Link><form method="post" action="/api/auth/logout"><button type="submit" className="text-link">Sign out</button></form></div>
    </header>

    <section className="organizer-summary" aria-label="RSVP totals">
      <div><Users size={21}/><strong>{attendingGuests}</strong><span>Guests attending</span><small>Includes {attendingChildren} {attendingChildren === 1 ? 'child' : 'children'}</small></div>
      <div><Check size={21}/><strong>{active.length}</strong><span>RSVP responses</span><small>{attending.length} attending {attending.length === 1 ? 'party' : 'parties'}</small></div>
      <div><Heart size={21}/><strong>{declined.length}</strong><span>Declined responses</span><small>Sending their love from afar</small></div>
      <div><Users size={21}/><strong>{attendingChildren}</strong><span>Children attending</span><small>Already included in guest totals</small></div>
    </section>

    <section className="organizer-guest-section" aria-labelledby="guest-list-heading">
      <div className="organizer-guest-heading">
        <div><span className="eyebrow">YOUR RSVP INBOX</span><h2 id="guest-list-heading">The guest list.</h2><p>Newest responses appear first. Open a response to see the full details.</p></div>
        <div className="organizer-list-actions"><button type="button" className="organizer-action-button" onClick={refresh} disabled={refreshing}><RefreshCw size={17} className={refreshing ? 'spin' : undefined}/>{refreshing ? 'Refreshing…' : 'Refresh responses'}</button><button type="button" className="organizer-action-button" onClick={exportCsv} disabled={!active.length}><Download size={17}/>Export all to CSV</button></div>
      </div>
      <p className="organizer-refresh-note" role="status">{refreshing ? 'Checking for new responses…' : refreshFrom && snapshot !== refreshFrom ? 'Responses refreshed. All times are shown in Newfoundland time.' : refreshFrom ? <>New responses could not be confirmed. Please try again or <a href="/manage">reload the workspace</a>.</> : 'Select Refresh responses to check for new replies. Times are shown in Newfoundland time.'}</p>
      <div className="organizer-list-controls">
        <label className="organizer-search-box"><Search size={19}/><span className="sr-only">Search guest responses</span><input type="search" placeholder="Search name, email, or confirmation reference" value={query} onChange={event => setQuery(event.target.value)}/></label>
        <div className="organizer-filter-buttons" role="group" aria-label="Filter responses by attendance">{filters.map(item => <button type="button" key={item.value} aria-pressed={filter === item.value} onClick={() => setFilter(item.value)}>{item.label}</button>)}</div>
      </div>
      <p className="organizer-result-count" aria-live="polite">{filtered.length} {filtered.length === 1 ? 'response' : 'responses'} shown{filter === 'active' ? ' · Archived responses excluded' : ''}</p>
      {filtered.length ? <div className="organizer-response-cards">{filtered.map(response => <details className="organizer-response-card" key={response.id}>
        <summary><span className="organizer-guest-identity"><strong>{response.name}</strong><span>{response.email}</span><small>{receivedAt(response.created_at)}</small></span><span className={`organizer-attendance-badge is-${response.attendance}`}>{response.attendance === 'attending' ? `${response.guests} attending` : response.attendance === 'archived' ? 'Archived' : 'Declined'}</span><ChevronDown className="organizer-card-chevron" size={18}/></summary>
        <div className="organizer-response-body">
          <dl className="organizer-response-facts">
            <div><dt>Confirmation reference</dt><dd>{reference(response.id)}</dd></div>
            <div><dt>Reply received</dt><dd>{receivedAt(response.created_at)}</dd></div>
            <div><dt>Email address</dt><dd><a href={`mailto:${response.email}`}>{response.email}</a></dd></div>
            <div><dt>Party size</dt><dd>{response.guests} {Number(response.guests) === 1 ? 'guest' : 'guests'} · {response.children || 0} children included</dd></div>
            {response.guest_names ? <div className="organizer-fact-wide"><dt>Other guests, including children</dt><dd>{response.guest_names}</dd></div> : null}
            {response.access_needs ? <div className="organizer-fact-wide"><dt>Access needs</dt><dd>{response.access_needs}</dd></div> : null}
            {response.dietary ? <div className="organizer-fact-wide"><dt>Dietary needs</dt><dd>{response.dietary}</dd></div> : null}
            {response.song ? <div className="organizer-fact-wide"><dt>Song request</dt><dd>{response.song}</dd></div> : null}
            {response.note ? <div className="organizer-fact-wide"><dt>Message for the couple</dt><dd>{response.note}</dd></div> : null}
          </dl>
          <ResponseEditor response={response} onSaved={(attendance, guests, children) => setRsvps(items => items.map(item => item.id === response.id ? {...item, attendance, guests, children} : item))}/>
        </div>
      </details>)}</div> : <div className="organizer-blank-state"><Users size={30}/><h3>{rsvps.length ? 'No responses match just yet.' : 'Your first reply has a place here.'}</h3><p>{rsvps.length ? 'Try another name or choose a different attendance filter.' : 'Once a guest successfully submits the RSVP form, their response appears here. Refresh this page whenever you want to check for new replies.'}</p>{rsvps.length ? <button type="button" className="text-link" onClick={() => {setQuery(''); setFilter('active');}}>Clear search and filters</button> : <a href="/rsvp" className="text-link">Open the guest RSVP form <ArrowUpRight size={16}/></a>}</div>}
      <p className="organizer-private-note">These responses are private. CSV exports include all active responses, even when a search or filter is applied.</p>
    </section>

    <EventSettings event={event}/>

    <section className="organizer-private-wishes" aria-labelledby="private-wishes-heading"><span className="eyebrow">THE GUESTBOOK · {wishes.length} {wishes.length === 1 ? 'MESSAGE' : 'MESSAGES'}</span><h2 id="private-wishes-heading">Words to treasure.</h2>{wishes.length ? <div>{wishes.map(wish => <article key={wish.id}><Heart size={18}/><p>{wish.message}</p><strong>{wish.name}</strong><small>{receivedAt(wish.created_at)}</small></article>)}</div> : <p className="organizer-private-note">Messages left in the guestbook will appear here privately.</p>}</section>
  </main>;
}

function EventSettings({event}: {event: WeddingEvent}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [failed, setFailed] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setStatus(''); setFailed(false);
    try {
      await saveOrganizerDetails(Object.fromEntries(new FormData(event.currentTarget)));
      setStatus('Wedding details saved. Guest pages will use the new details when opened.');
    } catch (error) {
      setFailed(true); setStatus(error instanceof Error ? error.message : 'Unable to save. Please try again.');
    } finally { setBusy(false); }
  }
  return <details className="organizer-settings-panel"><summary><span><span className="eyebrow">THE ESSENTIAL DETAILS</span><h2>Wedding settings.</h2></span><ChevronDown size={22}/></summary><div className="organizer-settings-content"><p>Update the details used across the homepage, wedding day, RSVP, directions, and calendar.</p><form method="post" action="/api/organizer" onSubmit={save}><fieldset disabled={busy}>
    <div className="form-two"><div className="field"><label htmlFor="event-date">Wedding date</label><input type="date" id="event-date" name="date" defaultValue={event.date}/></div><div className="field"><label htmlFor="event-time">Ceremony time</label><input type="time" id="event-time" name="time" defaultValue={event.time} required/></div></div>
    <div className="field"><label htmlFor="event-venue">Venue name</label><input id="event-venue" name="venue" defaultValue={event.venue} maxLength={200}/></div>
    <div className="field"><label htmlFor="event-address">Venue address</label><input id="event-address" name="address" defaultValue={event.address} maxLength={400}/></div>
    <div className="field"><label htmlFor="event-timezone">Timezone for calendars and countdown</label><input id="event-timezone" name="timezone" defaultValue={event.timezone} placeholder="America/St_Johns" list="timezones"/><datalist id="timezones"><option value="Africa/Accra"/><option value="America/St_Johns"/><option value="America/Toronto"/><option value="America/Edmonton"/><option value="Europe/London"/></datalist></div>
    <div className="field"><label htmlFor="event-dress">Dress code</label><input id="event-dress" name="dressCode" defaultValue={event.dressCode} maxLength={200}/></div>
    <div className="field"><label htmlFor="event-note">Guest announcement</label><textarea id="event-note" name="note" defaultValue={event.note} maxLength={1000} rows={3}/></div>
    {status ? <p role={failed ? 'alert' : 'status'} className={`organizer-save-status${failed ? ' is-error' : ''}`}>{status}</p> : null}
    <button className="button button-burgundy" disabled={busy}>{busy ? <LoaderCircle size={18} className="spin"/> : <CalendarDays size={18}/>}Save wedding details</button>
  </fieldset></form></div></details>;
}

function ResponseEditor({response, onSaved}: {response: Rsvp; onSaved: (attendance: string, guests: number, children: number) => void}) {
  const [snapshot, setSnapshot] = useState(response);
  const [attendance, setAttendance] = useState(response.attendance);
  const [guests, setGuests] = useState(String(response.guests || 1));
  const [children, setChildren] = useState(String(response.children || 0));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [failed, setFailed] = useState(false);
  if (snapshot !== response) {
    setSnapshot(response);
    setAttendance(response.attendance);
    setGuests(String(response.guests || 1));
    setChildren(String(response.children || 0));
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setStatus(''); setFailed(false);
    try {
      await saveOrganizerDetails({action: 'update_rsvp', id: response.id, attendance, guests: Number(guests), children: Number(children)});
      onSaved(attendance, attendance === 'attending' ? Number(guests) : 0, attendance === 'attending' ? Number(children) : 0);
      setStatus('Response updated.');
    } catch (error) {
      setFailed(true); setStatus(error instanceof Error ? error.message : 'Could not update. Please try again.');
    } finally { setSaving(false); }
  }
  return <form className="organizer-response-editor" onSubmit={save} method="post" action="/api/organizer"><input type="hidden" name="action" value="update_rsvp"/><input type="hidden" name="id" value={response.id}/><fieldset disabled={saving}><legend>Correct a response</legend><div className="organizer-editor-fields"><label>Response status<select name="attendance" value={attendance} onChange={event => setAttendance(event.target.value)}><option value="attending">Attending</option><option value="declined">Declined</option><option value="archived">Archived — duplicate or withdrawn</option></select></label>{attendance === 'attending' ? <><label>Party size, including children<input name="guests" type="number" min="1" max="10" required value={guests} onChange={event => setGuests(event.target.value)}/></label><label>Children included<input name="children" type="number" min="0" max={Number(guests)} required value={children} onChange={event => setChildren(event.target.value)}/></label></> : null}</div><button className="button button-burgundy" disabled={saving}>{saving ? 'Saving…' : 'Save correction'}</button>{status ? <p className={`organizer-save-status${failed ? ' is-error' : ''}`} role={failed ? 'alert' : 'status'}>{status}</p> : null}<p className="organizer-editor-hint">Archived responses are excluded from attendance totals and exports. You can restore them by changing their status.</p></fieldset></form>;
}

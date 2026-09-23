'use client';

import {useEffect, useId, useRef, useState, type FormEvent} from 'react';
import {ArrowLeft, ArrowUpRight, CalendarDays, Check, CheckCircle2, Clock, Download, Heart, LoaderCircle, LockKeyhole, Mail, MapPin, MessageCircle, Phone, Users} from 'lucide-react';
import {Frame, Photo} from '../wedding';
import {useWeddingEvent} from '../event-context';
import {displayDate, displayTime, displayTimezone} from '@/lib/event-types';
import {guestDetails} from '@/lib/guest-details';
import './form.css';

type Attendance = 'attending' | 'declined';
type Reply = {
  name: string;
  email: string;
  attendance: Attendance;
  guests: string;
  children: string;
  guestNames: string;
  dietary: string;
  accessNeeds: string;
  note: string;
  website: string;
};
type SavedReply = Reply & {reference: string};
type SubmissionError = {message: string; requestId?: string};

const fieldLabels: Record<string, string> = {
  name: 'Full name', email: 'Email address', attendance: 'Your attendance',
  guests: 'Total guests', children: 'Children', guestNames: 'Other guests’ names',
  dietary: 'Dietary requirements', accessNeeds: 'Access needs', note: 'Your note',
};

function readReply(form: HTMLFormElement): Reply {
  const data = new FormData(form);
  const value = (key: string) => String(data.get(key) || '').trim();
  const attendance = value('attendance') === 'declined' ? 'declined' : 'attending';
  return {
    name: value('name'), email: value('email'), attendance,
    guests: attendance === 'attending' ? value('guests') : '0',
    children: attendance === 'attending' ? value('children') : '0',
    guestNames: attendance === 'attending' ? value('guestNames') : '',
    dietary: attendance === 'attending' ? value('dietary') : '',
    accessNeeds: attendance === 'attending' ? value('accessNeeds') : '',
    note: value('note'), website: value('website'),
  };
}

function downloadConfirmation(text: string) {
  const url = URL.createObjectURL(new Blob([text], {type: 'text/plain;charset=utf-8'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'Frederick-Veronica-RSVP.txt';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function ReplySummary({reply}: {reply: Reply}) {
  return <dl className="fv-reply-summary">
    <div><dt>Name</dt><dd>{reply.name}</dd></div>
    <div><dt>Email</dt><dd>{reply.email}</dd></div>
    <div><dt>Your reply</dt><dd>{reply.attendance === 'attending' ? 'Joyfully attending' : 'With regrets'}</dd></div>
    {reply.attendance === 'attending' && <>
      <div><dt>Your party</dt><dd>{reply.guests} {reply.guests === '1' ? 'guest' : 'guests'} in total · {reply.children} {reply.children === '1' ? 'child' : 'children'} included</dd></div>
      {reply.guestNames && <div><dt>Other guests</dt><dd>{reply.guestNames}</dd></div>}
      {reply.dietary && <div><dt>Dietary requirements</dt><dd>{reply.dietary}</dd></div>}
      {reply.accessNeeds && <div><dt>Access needs</dt><dd>{reply.accessNeeds}</dd></div>}
    </>}
    {reply.note && <div><dt>Your note</dt><dd>{reply.note}</dd></div>}
  </dl>;
}

function ReplyHelpContacts() {
  return <div className="fv-reply-help-links"><a href="tel:+17098535838"><Phone size={16}/>Call Ibrahim</a><a href="https://wa.me/17098535838" target="_blank" rel="noopener noreferrer"><MessageCircle size={16}/>WhatsApp Ibrahim</a><a href={`mailto:${guestDetails.enquiryEmail}`}><Mail size={16}/>Email guest enquiries</a></div>;
}

export function RSVP({embedded = false}: {embedded?: boolean}) {
  const event = useWeddingEvent();
  const prefix = useId().replace(/:/g, '');
  const fieldId = (name: string) => `${prefix}-${name}`;
  const [attendance, setAttendance] = useState<Attendance>('attending');
  const [guests, setGuests] = useState('1');
  const [children, setChildren] = useState('0');
  const [review, setReview] = useState<Reply | null>(null);
  const [result, setResult] = useState<SavedReply | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<SubmissionError | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [unavailable, setUnavailable] = useState(false);
  const submission = useRef<{key: string; id: string} | null>(null);
  const inFlight = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const reviewRef = useRef<HTMLHeadingElement>(null);
  const successRef = useRef<HTMLHeadingElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    const request = new AbortController();
    const timeout = window.setTimeout(() => request.abort(), 15000);
    let active = true;
    fetch('/api/rsvp', {cache: 'no-store', signal: request.signal})
      .then(response => { if (active && response.status === 503) setUnavailable(true); })
      .catch(() => { /* A failed availability check must not prevent a reply. */ })
      .finally(() => window.clearTimeout(timeout));
    return () => { active = false; request.abort(); window.clearTimeout(timeout); };
  }, []);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  useEffect(() => { if (review && !error) reviewRef.current?.focus(); }, [review, error]);
  useEffect(() => { if (result) successRef.current?.focus(); }, [result]);

  function editReply() {
    setReview(null);
    setError(null);
    requestAnimationFrame(() => nameRef.current?.focus());
  }

  function changed(event: FormEvent<HTMLFormElement>) {
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
      const name = target.name;
      if (fieldErrors[name]) setFieldErrors(current => {
        const remaining = {...current};
        delete remaining[name];
        return remaining;
      });
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const reply = readReply(event.currentTarget);
    if (!review || JSON.stringify(reply) !== JSON.stringify(review)) {
      setError(null);
      setFieldErrors({});
      setReview(reply);
      return;
    }

    inFlight.current = true;
    setSending(true);
    setError(null);
    setFieldErrors({});
    let timedOut = false;
    const request = new AbortController();
    controller.current = request;
    const timeout = window.setTimeout(() => { timedOut = true; request.abort(); }, 20000);
    try {
      const key = JSON.stringify(reply);
      if (!submission.current || submission.current.key !== key) {
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        submission.current = {key, id: Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')};
      }
      const response = await fetch('/api/rsvp', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({...reply, id: submission.current.id}), signal: request.signal,
      });
      const data = await response.json().catch(() => null) as {
        success?: boolean; reference?: string; error?: string; requestId?: string;
        fieldErrors?: Record<string, string>;
      } | null;
      if (!response.ok || data?.success !== true || typeof data.reference !== 'string') {
        const errors = Object.fromEntries(Object.entries(data?.fieldErrors || {}).filter(([field, message]) => field in fieldLabels && typeof message === 'string'));
        if (Object.keys(errors).length) { setFieldErrors(errors); setReview(null); }
        setError({
          message: typeof data?.error === 'string' ? data.error : 'We couldn’t confirm that your response was saved. Your details are still here. Please try again.',
          requestId: typeof data?.requestId === 'string' ? data.requestId : undefined,
        });
        return;
      }
      setResult({...reply, reference: data.reference});
      setUnavailable(false);
    } catch {
      setError({message: timedOut
        ? 'The connection took too long. We haven’t received a confirmation, so please try saving again with the same details. Your information is still here.'
        : 'We couldn’t connect to save your response. Check your connection and try again. Your information is still here.'});
    } finally {
      window.clearTimeout(timeout);
      controller.current = null;
      inFlight.current = false;
      setSending(false);
    }
  }

  const errorFor = (name: string) => fieldErrors[name]
    ? <p className="fv-reply-field-error" id={`${fieldId(name)}-error`}>{fieldErrors[name]}</p> : null;
  const describedBy = (name: string, help?: string) => [help && `${fieldId(name)}-help`, fieldErrors[name] && `${fieldId(name)}-error`].filter(Boolean).join(' ') || undefined;
  const content = <section className={`fv-rsvp${embedded ? ' fv-rsvp-embedded' : ''}`} aria-labelledby={`${prefix}-title`}>
    <div className="fv-rsvp-invitation">
      <span className="fv-reply-eyebrow">A place in our celebration</span>
      {embedded ? <h2 id={`${prefix}-title`}>We’d love<br/><i>to have you.</i></h2> : <h1 id={`${prefix}-title`}>We’d love<br/><i>to have you.</i></h1>}
      <p>Join us as we begin our next chapter, surrounded by the people we love.</p>
      <div className="fv-rsvp-event">
        <div><CalendarDays size={19}/><span>{displayDate(event.date)}</span></div>
        <div><Clock size={19}/><span>{event.time === '12:00' ? '12:00 noon' : displayTime(event.time)}<small>{displayTimezone(event.timezone)}</small></span></div>
        <div><MapPin size={19}/><span>{event.venue}<small>{event.address}</small></span></div>
      </div>
      <div className="fv-rsvp-photo"><Photo id="IMG_5386" alt="Frederick and Veronica together, looking forward to their wedding"/><span>Frederick <i>&</i> Veronica</span></div>
      <p className="fv-rsvp-deadline">Kindly reply by <strong>{displayDate(guestDetails.rsvpDeadline)}</strong>.</p>
    </div>

    <div className="fv-rsvp-panel">
      {result ? <div className="fv-reply-success">
        <span className="fv-reply-success-icon"><CheckCircle2 size={34}/></span>
        <span className="fv-reply-eyebrow">Your response is saved</span>
        <h2 ref={successRef} tabIndex={-1}>{result.attendance === 'attending' ? <>See you<br/><i>at the celebration.</i></> : <>With love,<br/><i>from afar.</i></>}</h2>
        <p>Thank you, {result.name}. The organizer can now see your response in the private guest list.</p>
        <div className="fv-reply-reference"><span>Your RSVP reference</span><strong>{result.reference}</strong><span>{result.attendance === 'attending' ? `${result.guests} ${result.guests === '1' ? 'guest' : 'guests'} · ${result.children} ${result.children === '1' ? 'child' : 'children'} included` : 'Regretfully declining'}</span></div>
        <p className="fv-reply-small">No confirmation email is sent. Save the confirmation below for your records.</p>
        <button type="button" className="fv-reply-button" onClick={() => downloadConfirmation([
          'Frederick & Veronica — RSVP confirmation', '', `Name: ${result.name}`, `Reference: ${result.reference}`,
          `Response: ${result.attendance}`, `Guests: ${result.guests}`, `Children included: ${result.children}`,
          '', `Date: ${displayDate(event.date)}`, `Ceremony: ${displayTime(event.time)} (${displayTimezone(event.timezone)})`,
          `Venue: ${event.venue}`, event.address, '',
          'To change your response, quote your reference when contacting:',
          'Ibrahim: +1 (709) 853-5838 (calls and WhatsApp)', 'Gloria: +1 (709) 219-6808',
          `Guest enquiries: ${guestDetails.enquiryEmail}`, '',
        ].join('\n'))}><Download size={18}/>Download confirmation</button>
        <div className="fv-reply-success-links"><a href={embedded ? '#guestbook' : '/guestbook'}>Leave the couple a wish <Heart size={17}/></a><a href={`mailto:${guestDetails.enquiryEmail}?subject=${encodeURIComponent(`RSVP update — ${result.reference}`)}`}>Need to change your reply? <ArrowUpRight size={17}/></a></div>
      </div> : <form action="/api/rsvp" method="post" onSubmit={submit} onChange={changed} aria-busy={sending}>
        {unavailable && !error && <div className="fv-reply-availability" role="status"><strong>Online replies are temporarily unavailable.</strong><p>You can try the form again, or share your attendance and party details directly with our guest contacts.</p><ReplyHelpContacts/></div>}
        <div className="fv-reply-progress" aria-label={review ? 'Step 2 of 2: review and save' : 'Step 1 of 2: your details'}><span className={!review ? 'is-current' : 'is-complete'}>{review ? <Check size={15}/> : '01'} Your details</span><i/><span className={review ? 'is-current' : ''}>02 Review & save</span></div>
        {error && <div className="fv-reply-error" ref={errorRef} tabIndex={-1} role="alert">
          <strong>Let’s get your reply through.</strong><p>{error.message}</p>
          {Object.keys(fieldErrors).length > 0 && <ul>{Object.entries(fieldErrors).map(([name, message]) => <li key={name}><a href={`#${fieldId(name)}`} onClick={event => { event.preventDefault(); document.getElementById(fieldId(name))?.focus(); }}>{fieldLabels[name]}: {message}</a></li>)}</ul>}
          <p>If you need help, your guest contacts are here:</p><ReplyHelpContacts/>
          {error.requestId && <small>Support reference: {error.requestId}</small>}
        </div>}

        <fieldset className="fv-reply-fields" disabled={sending} hidden={!!review}>
          <div className="fv-reply-form-heading"><span className="fv-reply-eyebrow">Kindly RSVP</span><h2>A little about<br/><i>your plans.</i></h2><p>One reply per household or group. Fields marked * are required.</p></div>
          <fieldset className="fv-reply-attendance" aria-describedby={describedBy('attendance')}>
            <legend>Will you be joining us? *</legend>
            <label className={attendance === 'attending' ? 'is-selected' : ''}><input id={fieldId('attendance')} type="radio" name="attendance" value="attending" checked={attendance === 'attending'} onChange={() => setAttendance('attending')}/><span><strong>Joyfully accepts</strong><small>I’ll be there to celebrate.</small></span><Heart size={20}/></label>
            <label className={attendance === 'declined' ? 'is-selected' : ''}><input type="radio" name="attendance" value="declined" checked={attendance === 'declined'} onChange={() => setAttendance('declined')}/><span><strong>Regretfully declines</strong><small>Sending my love from afar.</small></span></label>
            {errorFor('attendance')}
          </fieldset>

          <div className="fv-reply-group"><h3><span>01</span>Your details</h3>
            <div className="fv-reply-field"><label htmlFor={fieldId('name')}>Full name *</label><input ref={nameRef} id={fieldId('name')} name="name" autoComplete="name" minLength={2} maxLength={100} required placeholder="Your first and last name" aria-invalid={!!fieldErrors.name} aria-describedby={describedBy('name')}/>{errorFor('name')}</div>
            <div className="fv-reply-field"><label htmlFor={fieldId('email')}>Email address *</label><input id={fieldId('email')} name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" maxLength={160} required placeholder="you@example.com" aria-invalid={!!fieldErrors.email} aria-describedby={describedBy('email')}/>{errorFor('email')}</div>
          </div>

          <fieldset className="fv-reply-group fv-reply-party" hidden={attendance !== 'attending'} disabled={attendance !== 'attending'}>
            <legend><span>02</span>Your party</legend>
            <p className="fv-reply-group-note">Children are very welcome. Include them in your total so we can arrange everyone’s seating.</p>
            <div className="fv-reply-columns">
              <div className="fv-reply-field"><label htmlFor={fieldId('guests')}>Total guests *</label><select id={fieldId('guests')} name="guests" value={guests} onChange={event => { setGuests(event.target.value); setChildren(current => String(Math.min(Number(current), Number(event.target.value)))); }} aria-invalid={!!fieldErrors.guests} aria-describedby={describedBy('guests', 'help')}>
                {Array.from({length: 10}, (_, index) => <option key={index + 1} value={index + 1}>{index + 1} {index === 0 ? 'guest' : 'guests'}</option>)}
              </select><p className="fv-reply-hint" id={`${fieldId('guests')}-help`}>Including you and any children.</p>{errorFor('guests')}</div>
              <div className="fv-reply-field"><label htmlFor={fieldId('children')}>Children included *</label><select id={fieldId('children')} name="children" value={children} onChange={event => setChildren(event.target.value)} aria-invalid={!!fieldErrors.children} aria-describedby={describedBy('children', 'help')}>
                {Array.from({length: Number(guests) + 1}, (_, index) => <option key={index} value={index}>{index} {index === 1 ? 'child' : 'children'}</option>)}
              </select><p className="fv-reply-hint" id={`${fieldId('children')}-help`}>Already part of your total.</p>{errorFor('children')}</div>
            </div>
            <div className="fv-reply-field"><label htmlFor={fieldId('guestNames')}>Other guests’ names {Number(guests) > 1 ? '*' : <span>optional</span>}</label><textarea id={fieldId('guestNames')} name="guestNames" rows={3} maxLength={600} required={Number(guests) > 1} placeholder="Full names of everyone joining you. Please mark any children." aria-invalid={!!fieldErrors.guestNames} aria-describedby={describedBy('guestNames')}/>{errorFor('guestNames')}</div>
            <div className="fv-reply-field"><label htmlFor={fieldId('dietary')}>Dietary requirements <span>optional</span></label><textarea id={fieldId('dietary')} name="dietary" rows={2} maxLength={600} placeholder="Include each guest’s name and their requirements." aria-invalid={!!fieldErrors.dietary} aria-describedby={describedBy('dietary')}/>{errorFor('dietary')}</div>
            <div className="fv-reply-field"><label htmlFor={fieldId('accessNeeds')}>Access needs <span>optional</span></label><textarea id={fieldId('accessNeeds')} name="accessNeeds" rows={3} maxLength={1000} placeholder="Tell us how we can help you or someone in your party." aria-invalid={!!fieldErrors.accessNeeds} aria-describedby={describedBy('accessNeeds', 'help')}/><p className="fv-reply-hint" id={`${fieldId('accessNeeds')}-help`}>We’ll make arrangements with the church. You can also speak privately with Ibrahim or Gloria.</p>{errorFor('accessNeeds')}</div>
          </fieldset>

          <div className="fv-reply-group"><h3><span>{attendance === 'attending' ? '03' : '02'}</span>A little love</h3><div className="fv-reply-field"><label htmlFor={fieldId('note')}>A note for the couple <span>optional</span></label><textarea id={fieldId('note')} name="note" rows={3} maxLength={1000} placeholder="Anything you’d like Frederick and Veronica to know…" aria-invalid={!!fieldErrors.note} aria-describedby={describedBy('note')}/>{errorFor('note')}</div></div>
          <div className="fv-reply-honey" aria-hidden="true"><label htmlFor={fieldId('website')}>Leave this field empty</label><input id={fieldId('website')} name="website" tabIndex={-1} autoComplete="off"/></div>
        </fieldset>

        {review && <div className="fv-reply-review"><span className="fv-reply-eyebrow">One last look</span><h2 ref={reviewRef} tabIndex={-1}>All looking<br/><i>lovely?</i></h2><p>Check your details, then save your reply. It reaches the organizer only after you save.</p><ReplySummary reply={review}/><button type="button" className="fv-reply-edit" disabled={sending} onClick={editReply}><ArrowLeft size={17}/>Edit my details</button></div>}
        <div className="fv-reply-submit-area">
          <p className="fv-reply-privacy"><LockKeyhole size={17}/><span>Your reply, contact details and access needs are private. No confirmation email is sent; you can download a confirmation after saving.</span></p>
          <button className="fv-reply-button" type="submit" disabled={sending}>{sending ? <><LoaderCircle className="fv-reply-spinner" size={19}/>Saving your response…</> : review ? <><Check size={19}/>Save my RSVP</> : <>Review my RSVP <ArrowUpRight size={19}/></>}</button>
          <p className="fv-reply-submit-note">{review ? 'Your response is not saved until you see your confirmation.' : <><Users size={15}/>Please include everyone in your party.</>}</p>
        </div>
      </form>}
    </div>
  </section>;

  return embedded ? content : <Frame page="rsvp">{content}</Frame>;
}

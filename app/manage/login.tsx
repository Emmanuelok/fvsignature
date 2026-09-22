'use client';
import {useState, type FormEvent} from 'react';

export function OrganizerLogin({initialError = ''}: {initialError?: string}) {
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);
  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = event.currentTarget;
    try {
      const response = await fetch('/api/auth/login', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({password: new FormData(form).get('password')})});
      const result = await response.json() as {error?: string};
      if (!response.ok) throw new Error(result.error || 'Sign-in is temporarily unavailable.');
      form.reset();
      window.location.assign('/manage');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Please try again.');
      setBusy(false);
    }
  }
  return <form action="/api/auth/login" method="post" onSubmit={signIn} style={{width: '100%', maxWidth: 400}}><fieldset disabled={busy}><div className="field"><label htmlFor="organizer-password">Organizer password</label><input id="organizer-password" name="password" type="password" autoComplete="current-password" maxLength={256} required aria-describedby={error ? 'login-error' : undefined}/></div>{error && <p id="login-error" role="alert" className="form-error">{error}</p>}<button className="button button-burgundy" disabled={busy}>{busy ? 'Signing in…' : 'Sign in to the organizer'}</button></fieldset></form>;
}

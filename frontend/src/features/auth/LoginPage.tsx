import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useLoginMutation } from '../../api/endpoints';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { ErrorNote } from '../../components/ui';
import { errorText } from '../../lib/format';
import { loggedIn } from './authSlice';

export function LoginPage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const [login, { isLoading, error }] = useLoginMutation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleError, setRoleError] = useState<string | null>(null);

  if (user) return <Navigate to={user.role === 'admin' ? '/' : '/patients'} replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setRoleError(null);
    const result = await login({ email, password });
    if ('data' in result && result.data) {
      const { token, user: signedIn } = result.data.data;
      // Patient accounts have no screens here yet; this app is for clinic staff.
      if (signedIn.role === 'patient') {
        setRoleError('FastRev is for clinic staff. Patient accounts cannot sign in here yet.');
        return;
      }
      dispatch(loggedIn({ token, user: signedIn }));
    }
  }

  return (
    <main className="login">
      <form className="card login-card" onSubmit={submit}>
        <div className="brand brand-large">
          <span className="brand-mark" aria-hidden>F</span> FastRev
        </div>
        <p className="muted">Sign in to manage patients, appointments and no-show risk.</p>
        <label>
          Email
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <ErrorNote message={roleError ?? errorText(error)} />
        <button className="btn primary" type="submit" disabled={isLoading}>
          {isLoading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}

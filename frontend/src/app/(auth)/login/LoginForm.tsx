'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { BrandMark, ErrorNote } from '@/components/ui';
import { useLogin } from '@/lib/api/hooks';
import { homeFor, STAFF_ROLES } from '@/lib/auth/roles';
import { authStore, useAuth } from '@/lib/auth/store';
import { errorText } from '@/lib/format';

export function LoginForm() {
  const router = useRouter();
  const auth = useAuth();
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleError, setRoleError] = useState<string | null>(null);
  const [slowStart, setSlowStart] = useState(false);
  const [copiedField, setCopiedField] = useState<'email' | 'password' | null>(null);
  const user = auth.status === 'ready' ? auth.session?.user : undefined;

  function copyToClipboard(text: string, field: 'email' | 'password') {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  }

  function fillDemo() {
    setEmail('demo@fastrev.app');
    setPassword('Demo1234!');
  }

  useEffect(() => {
    if (user) router.replace(homeFor(user.role));
  }, [user, router]);

  useEffect(() => {
    if (!login.isPending) return;
    const timer = setTimeout(() => setSlowStart(true), 4000);
    return () => {
      clearTimeout(timer);
      setSlowStart(false);
    };
  }, [login.isPending]);

  function submit(event: FormEvent) {
    event.preventDefault();
    setRoleError(null);
    login.mutate({ email: email.trim(), password }, {
      onSuccess: ({ data: { token, user: signedIn } }) => {
        // Patient accounts have no screens here yet; this app is for clinic staff.
        if (!STAFF_ROLES.includes(signedIn.role)) {
          setRoleError('FastRev is for clinic staff. Patient accounts cannot sign in here yet.');
          return;
        }
        authStore.signIn({ token, user: signedIn });
      },
    });
  }

  return (
    <div className="w-full max-w-sm">
      {/* The panel beside this form carries the mark on large screens, so it shows only where that is hidden. */}
      <span className="mb-10 block lg:hidden"><BrandMark large /></span>
      <h1>Sign in</h1>
      <p className="muted mt-2">Manage patients, appointments and no-show risk.</p>

      <div className="mt-6 rounded-md border border-hairline bg-surface-soft p-3.5 text-xs">
        <div className="flex items-center justify-between font-medium text-muted">
          <span className="font-semibold uppercase tracking-wider text-[11px] text-muted">Demo Credentials</span>
          <button
            type="button"
            onClick={fillDemo}
            className="font-semibold text-link hover:underline cursor-pointer"
          >
            ⚡ 1-Click Auto Fill
          </button>
        </div>
        <div className="mt-2.5 flex flex-col gap-1.5 font-mono text-[13px]">
          <div className="flex items-center justify-between rounded border border-hairline bg-canvas px-2.5 py-1.5">
            <span className="text-body select-all">demo@fastrev.app</span>
            <button
              type="button"
              onClick={() => copyToClipboard('demo@fastrev.app', 'email')}
              className="ml-2 font-sans text-xs text-link hover:underline cursor-pointer"
            >
              {copiedField === 'email' ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <div className="flex items-center justify-between rounded border border-hairline bg-canvas px-2.5 py-1.5">
            <span className="text-body select-all">Demo1234!</span>
            <button
              type="button"
              onClick={() => copyToClipboard('Demo1234!', 'password')}
              className="ml-2 font-sans text-xs text-link hover:underline cursor-pointer"
            >
              {copiedField === 'password' ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        </div>
        <p className="mt-2 font-sans text-[11px] text-muted">
          Recruiter access with pre-seeded clinic data and prediction scoring.
        </p>
      </div>

      <form className="mt-8 flex flex-col gap-5" onSubmit={submit}>
        <label className="field">
          Email
          <input className="input" type="email" autoComplete="username" required value={email}
            onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          Password
          <input className="input" type="password" autoComplete="current-password" required value={password}
            onChange={(e) => setPassword(e.target.value)} />
        </label>
        <div>
          <ErrorNote message={roleError ?? errorText(login.error)} />
          <button className="btn btn-primary w-full" type="submit" disabled={login.isPending}>
            {login.isPending ? 'Signing in…' : 'Sign in'}
          </button>
          {login.isPending && slowStart && (
            <p className="meta mt-3" role="status">
              Waking up the server and database — the first sign-in after idle can take up to a minute.
            </p>
          )}
        </div>
      </form>
    </div>
  );
}

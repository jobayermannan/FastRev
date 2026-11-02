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
  const user = auth.status === 'ready' ? auth.session?.user : undefined;

  useEffect(() => {
    if (user) router.replace(homeFor(user.role));
  }, [user, router]);

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
        </div>
      </form>
    </div>
  );
}

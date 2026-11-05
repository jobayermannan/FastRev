'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { FullPageMessage } from '@/components/ui';
import type { Role } from '@/lib/api/types';
import { homeFor } from '@/lib/auth/roles';
import { useAuth } from '@/lib/auth/store';

/**
 * Renders children only for a signed-in user with one of the allowed roles; everyone else is redirected.
 * This is a UX guard — the API enforces the same roles on every request.
 */
export function RoleGate({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const auth = useAuth();
  const router = useRouter();
  const user = auth.status === 'ready' ? auth.session?.user ?? null : null;
  const allowed = Boolean(user && roles.includes(user.role));

  useEffect(() => {
    if (auth.status !== 'ready') return;
    if (!user) router.replace('/login');
    else if (!allowed) router.replace(homeFor(user.role));
  }, [auth.status, user, allowed, router]);

  if (!allowed) return <FullPageMessage>Loading…</FullPageMessage>;
  return <>{children}</>;
}

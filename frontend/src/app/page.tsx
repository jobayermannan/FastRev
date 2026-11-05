'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { FullPageMessage } from '@/components/ui';
import { homeFor } from '@/lib/auth/roles';
import { useAuth } from '@/lib/auth/store';

/** Sends each visitor to the right starting screen for their role. */
export default function HomePage() {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (auth.status !== 'ready') return;
    router.replace(auth.session ? homeFor(auth.session.user.role) : '/login');
  }, [auth, router]);

  return <FullPageMessage>Loading…</FullPageMessage>;
}

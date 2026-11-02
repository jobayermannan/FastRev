'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { ApiError } from '@/lib/api/client';
import { authStore } from '@/lib/auth/store';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        refetchOnWindowFocus: true,
        // Client errors (bad input, no permission, not found) will not fix themselves on retry.
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failureCount < 2,
      },
      mutations: { retry: false },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  // One client per browser session, created lazily so it is never shared between server requests.
  const [client] = useState(makeQueryClient);

  // Signing out — by button, by expired token, or from another tab — must not leave cached patient data behind.
  useEffect(() => {
    authStore.setSignOutHandler(() => client.clear());
    return () => authStore.setSignOutHandler(null);
  }, [client]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

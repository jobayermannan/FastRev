import type { ReactNode } from 'react';
import { AppShell } from '@/components/AppShell';
import { RoleGate } from '@/components/RoleGate';
import { STAFF_ROLES } from '@/lib/auth/roles';

/** Every dashboard screen requires a signed-in clinic staff member; pages narrow roles further. */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGate roles={STAFF_ROLES}>
      <AppShell>{children}</AppShell>
    </RoleGate>
  );
}

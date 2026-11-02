import type { Role } from '@/lib/api/types';

export interface NavItem {
  href: string;
  label: string;
  roles: Role[];
}

/** Single source of truth for which role sees which screen; used by the sidebar and page guards. */
export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', roles: ['admin'] },
  { href: '/appointments', label: 'Appointments', roles: ['admin'] },
  { href: '/patients', label: 'Patients', roles: ['admin', 'doctor'] },
  { href: '/doctors', label: 'Doctors', roles: ['admin'] },
];

/** Roles allowed into the staff dashboard. Patient accounts have no screens yet. */
export const STAFF_ROLES: Role[] = ['admin', 'doctor'];

export function homeFor(role: Role) {
  return role === 'admin' ? '/dashboard' : '/patients';
}

import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppointmentQuery } from '@/lib/api/types';
import { authStore } from '@/lib/auth/store';

/**
 * The three views each mean something different to a clinic, and each one is a different query.
 * These are regression tests: the counts on the dashboard link straight into these views, so a
 * view that quietly filters differently makes a count and the list it opens disagree.
 */
let searchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParams,
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/appointments',
}));

type AppointmentsHook = (query: AppointmentQuery, options?: unknown) =>
  { data: undefined; error: null; isPending: boolean; isFetching: boolean };

const useAppointments = vi.fn<AppointmentsHook>(() =>
  ({ data: undefined, error: null, isPending: true, isFetching: false }));
vi.mock('@/lib/api/hooks', () => ({
  useAppointments: (query: AppointmentQuery, options?: unknown) => useAppointments(query, options),
  usePatients: () => ({ data: undefined, isPending: true }),
  useDoctors: () => ({ data: undefined, isPending: true }),
}));

const { default: AppointmentsPage } = await import('@/app/(dashboard)/appointments/page');

function queryFor(search: string): AppointmentQuery {
  searchParams = new URLSearchParams(search);
  useAppointments.mockClear();
  render(<AppointmentsPage />);
  const lastCall = useAppointments.mock.calls.at(-1);
  if (!lastCall) throw new Error('The page never queried for appointments.');
  return lastCall[0];
}

beforeEach(() => {
  authStore.signIn({ token: 't', user: { id: 'u1', email: 'admin@fastrev.test', role: 'admin' } });
});

describe('appointment views', () => {
  it('asks for still-open bookings from now on, oldest first', () => {
    const query = queryFor('');
    expect(query.status).toBe('booked,confirmed');
    expect(query.order).toBe('asc');
    expect(query.from).toBeTruthy();
  });

  it('drops a status filter in the outcome view, which would contradict it', () => {
    const query = queryFor('view=outcome&status=cancelled');
    expect(query.needsOutcome).toBe(true);
    expect(query.status).toBeUndefined();
  });

  it('keeps an explicit status in the upcoming view', () => {
    expect(queryFor('view=upcoming&status=confirmed').status).toBe('confirmed');
  });

  it('carries the risk filter the dashboard links with', () => {
    const query = queryFor('view=upcoming&risk=high');
    expect(query.riskLevel).toBe('high');
    expect(query.status).toBe('booked,confirmed');
  });

  it('filters nothing by default in the all view', () => {
    const query = queryFor('view=all');
    expect(query.status).toBeUndefined();
    expect(query.needsOutcome).toBeUndefined();
    expect(query.from).toBeUndefined();
  });
});

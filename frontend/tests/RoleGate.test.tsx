import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RoleGate } from '@/components/RoleGate';
import { authStore } from '@/lib/auth/store';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

const signIn = (role: 'admin' | 'doctor' | 'patient') =>
  authStore.signIn({ token: 't', user: { id: 'u1', email: `${role}@fastrev.test`, role } });

beforeEach(() => {
  replace.mockClear();
  authStore.signOut();
});

describe('RoleGate', () => {
  it('renders the screen for an allowed role', () => {
    signIn('admin');
    render(<RoleGate roles={['admin']}>Dashboard</RoleGate>);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('sends a signed-out visitor to the login page', async () => {
    render(<RoleGate roles={['admin']}>Dashboard</RoleGate>);
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
  });

  it('sends the wrong role to its own home instead of showing the screen', async () => {
    signIn('doctor');
    render(<RoleGate roles={['admin']}>Dashboard</RoleGate>);
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/patients'));
  });

  it('never renders the guarded screen while redirecting', () => {
    signIn('patient');
    render(<RoleGate roles={['admin', 'doctor']}>Patients</RoleGate>);
    expect(screen.queryByText('Patients')).not.toBeInTheDocument();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });
});

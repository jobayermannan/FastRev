import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginForm } from '@/app/(auth)/login/LoginForm';
import { ApiError } from '@/lib/api/client';
import { authStore } from '@/lib/auth/store';

const replace = vi.fn();
const mutate = vi.fn();
const mockLogin = { mutate, isPending: false, error: null as Error | null };

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('@/lib/api/hooks', () => ({ useLogin: () => mockLogin }));

beforeEach(() => {
  replace.mockClear();
  mutate.mockClear();
  mockLogin.isPending = false;
  mockLogin.error = null;
  authStore.signOut();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('LoginForm', () => {
  it('trims the email, stores staff sessions and redirects to the role home', () => {
    mutate.mockImplementation((_payload, { onSuccess }) => {
      onSuccess({ data: { token: 'jwt-1', user: { id: 'u1', email: 'demo@fastrev.app', role: 'admin' } } });
    });

    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: '  demo@fastrev.app  ' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(mutate).toHaveBeenCalledWith(
      { email: 'demo@fastrev.app', password: 'secret123' },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(authStore.getToken()).toBe('jwt-1');
    expect(replace).toHaveBeenCalledWith('/dashboard');
  });

  it('refuses patient accounts on the staff sign-in screen without saving a session', () => {
    mutate.mockImplementation((_payload, { onSuccess }) => {
      onSuccess({ data: { token: 'jwt-p', user: { id: 'u2', email: 'pat@fastrev.app', role: 'patient' } } });
    });

    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'pat@fastrev.app' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(authStore.getToken()).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent(/clinic staff/i);
  });

  it('surfaces the 503 waking-up message when the managed database is still starting', () => {
    mockLogin.error = new ApiError(503, 'The database is waking up. Try again in a moment.');
    render(<LoginForm />);
    expect(screen.getByRole('alert')).toHaveTextContent('The database is waking up. Try again in a moment.');
  });

  it('explains cold starts when sign-in stays pending past four seconds', () => {
    vi.useFakeTimers();
    mockLogin.isPending = true;

    render(<LoginForm />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.getByRole('status')).toHaveTextContent(/waking up the server and database/i);
  });
});

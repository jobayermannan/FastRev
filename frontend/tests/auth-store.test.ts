import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { authStore, useAuth } from '@/lib/auth/store';

const SESSION = { token: 't0ken', user: { id: 'u1', email: 'admin@fastrev.test', role: 'admin' as const } };

afterEach(() => {
  authStore.setSignOutHandler(null);
  authStore.signOut();
});

describe('authStore', () => {
  it('persists the session so a reload stays signed in', () => {
    authStore.signIn(SESSION);
    expect(JSON.parse(window.localStorage.getItem('fastrev.session') ?? 'null')).toEqual(SESSION);
    expect(authStore.getToken()).toBe('t0ken');
  });

  it('clears storage on sign-out', () => {
    authStore.signIn(SESSION);
    authStore.signOut();
    expect(window.localStorage.getItem('fastrev.session')).toBeNull();
    expect(authStore.getToken()).toBeNull();
  });

  it('fires the sign-out handler once, and not on a sign-out from an empty state', () => {
    const onSignOut = vi.fn();
    authStore.setSignOutHandler(onSignOut);

    authStore.signOut();
    expect(onSignOut).not.toHaveBeenCalled();

    authStore.signIn(SESSION);
    authStore.signOut();
    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it('signs this tab out when another tab clears the session', () => {
    authStore.signIn(SESSION);
    const onSignOut = vi.fn();
    authStore.setSignOutHandler(onSignOut);
    // A subscriber has to exist for the storage listener to be attached.
    const unsubscribe = subscribeOnce();

    act(() => {
      window.localStorage.removeItem('fastrev.session');
      window.dispatchEvent(new StorageEvent('storage', { key: 'fastrev.session', newValue: null }));
    });

    expect(authStore.getToken()).toBeNull();
    expect(onSignOut).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it('ignores storage events for other keys', () => {
    authStore.signIn(SESSION);
    const unsubscribe = subscribeOnce();

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'something.else', newValue: null }));
    });

    expect(authStore.getToken()).toBe('t0ken');
    unsubscribe();
  });
});

/**
 * The cross-tab listener is attached by the store's own `subscribe`, which only runs while
 * something is subscribed — so these tests mount the hook to get the real wiring.
 */
function subscribeOnce() {
  return renderHook(() => useAuth()).unmount;
}

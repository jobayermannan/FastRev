'use client';

import { useSyncExternalStore } from 'react';
import type { User } from '@/lib/api/types';

const STORAGE_KEY = 'fastrev.session';

export interface Session {
  token: string;
  user: User;
}

/** `loading` until the browser has read storage, so guards never redirect during hydration. */
export type AuthState = { status: 'loading' } | { status: 'ready'; session: Session | null };

const LOADING: AuthState = { status: 'loading' };
let state: AuthState | null = null;
const listeners = new Set<() => void>();

function readStorage(): Session | null {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (saved?.token && saved?.user?.role) return saved as Session;
  } catch {
    // Storage can be unavailable or hold a corrupt value; start signed out.
  }
  return null;
}

function snapshot(): AuthState {
  if (state === null) state = { status: 'ready', session: readStorage() };
  return state;
}

/** Run when a session ends, so cached data never outlives the user it belongs to. */
let onSignOut: (() => void) | null = null;

function setSession(session: Session | null) {
  const hadSession = state?.status === 'ready' && state.session !== null;
  state = { status: 'ready', session };
  try {
    if (session) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // The session still works for this tab without storage.
  }
  if (hadSession && !session) onSignOut?.();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Keep tabs in sync: signing out in one tab signs out the others.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    const hadSession = state?.status === 'ready' && state.session !== null;
    state = { status: 'ready', session: readStorage() };
    if (hadSession && !state.session) onSignOut?.();
    listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export const authStore = {
  getToken(): string | null {
    if (typeof window === 'undefined') return null;
    const current = snapshot();
    return current.status === 'ready' ? current.session?.token ?? null : null;
  },
  signIn: (session: Session) => setSession(session),
  signOut: () => setSession(null),
  /** Registered once by the query provider; fires on every sign-out, including an expired token. */
  setSignOutHandler(handler: (() => void) | null) {
    onSignOut = handler;
  },
};

export function useAuth(): AuthState {
  return useSyncExternalStore(subscribe, snapshot, () => LOADING);
}

/** The signed-in user, or null while loading or signed out. */
export function useCurrentUser(): User | null {
  const auth = useAuth();
  return auth.status === 'ready' ? auth.session?.user ?? null : null;
}

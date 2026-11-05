import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

/*
  Node 22 defines its own `localStorage` global, which stays undefined unless the process is
  started with --localstorage-file. Vitest leaves globals that already exist alone, so jsdom's
  Storage never lands and `window.localStorage` is undefined. The auth store reads it, so the
  tests supply the same in-memory Storage jsdom would have given.
*/
if (!window.localStorage) {
  const entries = new Map<string, string>();
  const storage: Storage = {
    get length() { return entries.size; },
    key: (index) => [...entries.keys()][index] ?? null,
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => void entries.set(key, String(value)),
    removeItem: (key) => void entries.delete(key),
    clear: () => entries.clear(),
  };
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
}

// Every test starts signed out with an empty store; otherwise one test's session leaks into the next.
beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
});

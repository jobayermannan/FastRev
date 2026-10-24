import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { User } from '../../api/types';

const STORAGE_KEY = 'fastrev.session';

interface AuthState {
  token: string | null;
  user: User | null;
}

function loadSession(): AuthState {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (saved?.token && saved?.user) return saved;
  } catch {
    // Storage can be unavailable or hold a corrupt value; start signed out.
  }
  return { token: null, user: null };
}

function saveSession(state: AuthState) {
  try {
    if (state.token) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // The session still works for this tab without storage.
  }
}

const authSlice = createSlice({
  name: 'auth',
  initialState: loadSession,
  reducers: {
    loggedIn(state, action: PayloadAction<{ token: string; user: User }>) {
      state.token = action.payload.token;
      state.user = action.payload.user;
      saveSession(state);
    },
    loggedOut(state) {
      state.token = null;
      state.user = null;
      saveSession(state);
    },
  },
});

export const { loggedIn, loggedOut } = authSlice.actions;
export default authSlice.reducer;

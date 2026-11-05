import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiRequest, toQuery } from '@/lib/api/client';
import { authStore } from '@/lib/auth/store';

function respond(status: number, body: unknown) {
  return new Response(body === undefined ? '' : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  authStore.setSignOutHandler(null);
  authStore.signOut();
});

describe('toQuery', () => {
  it('drops empty values so a cleared filter does not reach the API', () => {
    expect(toQuery({ page: 1, status: '', riskLevel: undefined, from: null })).toBe('?page=1');
  });

  it('returns nothing when every value is empty', () => {
    expect(toQuery({ status: '', order: undefined })).toBe('');
  });
});

describe('apiRequest', () => {
  it('sends the stored token and parses the envelope', async () => {
    authStore.signIn({ token: 't0ken', user: { id: 'u1', email: 'a@b.test', role: 'admin' } });
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValue(respond(200, { success: true, data: { id: 'p1' } }));

    await expect(apiRequest('/patients/p1')).resolves.toEqual({ success: true, data: { id: 'p1' } });

    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer t0ken');
  });

  it('reports an unreachable server as status 0 rather than a thrown fetch error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(apiRequest('/patients')).rejects.toMatchObject({ status: 0 });
  });

  it('carries the server message and body into the ApiError', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      respond(409, { success: false, message: 'That slot is already booked.' }),
    );
    await expect(apiRequest('/appointments', { method: 'POST', body: {} }))
      .rejects.toMatchObject({ status: 409, message: 'That slot is already booked.' });
  });

  it('signs the user out when a token is rejected mid-session', async () => {
    authStore.signIn({ token: 'stale', user: { id: 'u1', email: 'a@b.test', role: 'admin' } });
    const onSignOut = vi.fn();
    authStore.setSignOutHandler(onSignOut);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(respond(401, { message: 'Unauthorized' }));

    await expect(apiRequest('/patients')).rejects.toBeInstanceOf(ApiError);
    expect(authStore.getToken()).toBeNull();
    // The cache has to be cleared too, or the next user sees the last one's rows.
    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it('leaves a failed sign-in alone: wrong credentials are not an expired session', async () => {
    const onSignOut = vi.fn();
    authStore.setSignOutHandler(onSignOut);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(respond(401, { message: 'Invalid credentials' }));

    await expect(apiRequest('/auth/login', { method: 'POST', body: {} })).rejects.toBeInstanceOf(ApiError);
    expect(onSignOut).not.toHaveBeenCalled();
  });
});

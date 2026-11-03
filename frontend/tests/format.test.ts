import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api/client';
import { ageFrom, errorText, formatDate, formatPercent, isStatus, localInputToIso, nowForInput } from '@/lib/format';

describe('formatDate', () => {
  it('keeps a date of birth on its stored calendar day', () => {
    // Stored at UTC midnight. Formatted in local time it would slip to the 11th west of UTC.
    expect(formatDate('1991-04-12T00:00:00.000Z')).toContain('12');
    expect(formatDate('1991-04-12T00:00:00.000Z')).toContain('1991');
  });
});

describe('formatPercent', () => {
  it('rounds to whole percent', () => {
    expect(formatPercent(0.714)).toBe('71%');
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(1)).toBe('100%');
  });

  it('shows a dash when there is no rate to show', () => {
    expect(formatPercent(null)).toBe('—');
  });
});

describe('ageFrom', () => {
  it('counts a birthday that has not come round yet as the younger age', () => {
    const now = new Date();
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear() - 30, now.getUTCMonth(), now.getUTCDate() + 1));
    expect(ageFrom(tomorrow.toISOString())).toBe(29);
  });

  it('counts today’s birthday as the full age', () => {
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear() - 30, now.getUTCMonth(), now.getUTCDate()));
    expect(ageFrom(today.toISOString())).toBe(30);
  });
});

describe('datetime-local round trip', () => {
  it('turns an input value back into the same local minute', () => {
    const value = nowForInput(60);
    const iso = localInputToIso(value);
    expect(new Date(iso).getTime()).toBe(new Date(value).getTime());
  });

  it('zeroes the seconds so the input accepts the value', () => {
    expect(nowForInput()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});

describe('errorText', () => {
  it('says the server is unreachable rather than repeating a network message', () => {
    expect(errorText(new ApiError(0, 'Cannot reach the FastRev server.')))
      .toBe('Cannot reach the FastRev server. Check that the API is running.');
  });

  it('turns validation details into one readable sentence', () => {
    const error = new ApiError(400, 'Validation failed', {
      error: { details: [{ path: ['body', 'phone'], message: 'Required' }] },
    });
    expect(errorText(error)).toBe('body.phone: Required');
  });

  it('explains a 403 in the user’s terms', () => {
    expect(errorText(new ApiError(403, 'Forbidden'))).toBe('Your account does not have permission for this.');
  });

  it('falls back to the server message, then to a plain Error, then to null', () => {
    expect(errorText(new ApiError(409, 'That slot is already booked.'))).toBe('That slot is already booked.');
    expect(errorText(new Error('boom'))).toBe('boom');
    expect(errorText(null)).toBeNull();
  });
});

describe('isStatus', () => {
  it('matches only an ApiError of that status', () => {
    expect(isStatus(new ApiError(404, 'Not found'), 404)).toBe(true);
    expect(isStatus(new ApiError(500, 'Server error'), 404)).toBe(false);
    expect(isStatus(new Error('Not found'), 404)).toBe(false);
  });
});

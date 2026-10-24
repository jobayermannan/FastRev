import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import type { SerializedError } from '@reduxjs/toolkit';

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
// Dates of birth are calendar dates stored at UTC midnight; formatting them in UTC keeps the day from shifting.
const dateOnly = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' });

export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));
export const formatDate = (iso: string) => dateOnly.format(new Date(iso));
export const formatPercent = (value: number | null) => (value === null ? '—' : `${Math.round(value * 100)}%`);

export function ageFrom(dateOfBirth: string) {
  const dob = new Date(dateOfBirth);
  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  if (now.getUTCMonth() < dob.getUTCMonth() ||
    (now.getUTCMonth() === dob.getUTCMonth() && now.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}

/** Converts a `datetime-local` input value to an ISO timestamp in the browser's time zone. */
export const localInputToIso = (value: string) => new Date(value).toISOString();

/** The current minute, as a `datetime-local` input value. */
export function nowForInput(offsetMinutes = 0) {
  const date = new Date(Date.now() + offsetMinutes * 60_000);
  date.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Turns an RTK Query error into a sentence a clinic user can act on. */
export function errorText(error: FetchBaseQueryError | SerializedError | undefined): string | null {
  if (!error) return null;
  if ('status' in error) {
    if (error.status === 'FETCH_ERROR') return 'Cannot reach the FastRev server. Check that the API is running.';
    const body = error.data as { message?: string; error?: { details?: unknown } } | undefined;
    const details = body?.error?.details;
    if (Array.isArray(details) && details.length) {
      return details.map((d: { path?: string[]; message?: string }) =>
        `${d.path?.join('.') ?? 'field'}: ${d.message}`).join('; ');
    }
    if (error.status === 403) return 'Your account does not have permission for this.';
    return body?.message ?? `Request failed (${error.status}).`;
  }
  return error.message ?? 'Something went wrong.';
}

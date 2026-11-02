'use client';

import { useRetryPrediction, useUpdateAppointmentStatus } from '@/lib/api/hooks';
import type { Appointment, AppointmentStatus } from '@/lib/api/types';
import { errorText } from '@/lib/format';

type Tone = 'btn-secondary' | 'btn-danger' | 'btn-success';

// Mirrors the backend's allowed transitions; completed, no-show and cancelled are final.
const NEXT: Partial<Record<AppointmentStatus, { status: AppointmentStatus; label: string; tone: Tone }[]>> = {
  booked: [
    { status: 'confirmed', label: 'Confirm', tone: 'btn-secondary' },
    { status: 'cancelled', label: 'Cancel', tone: 'btn-danger' },
  ],
  confirmed: [
    { status: 'completed', label: 'Attended', tone: 'btn-success' },
    { status: 'no_show', label: 'No-show', tone: 'btn-danger' },
    { status: 'cancelled', label: 'Cancel', tone: 'btn-danger' },
  ],
};

/** `align` is `start` in the stacked mobile card, where the buttons may wrap, and `end` in the table row. */
export function AppointmentActions({ appointment, align = 'end' }: { appointment: Appointment; align?: 'start' | 'end' }) {
  const updateStatus = useUpdateAppointmentStatus();
  const retry = useRetryPrediction();
  const busy = updateStatus.isPending || retry.isPending;

  async function change(status: AppointmentStatus) {
    if (status === 'cancelled' && !window.confirm('Cancel this appointment? Its reminders are cancelled and the slot is freed.')) return;
    await updateStatus.mutateAsync({ id: appointment.id, status }).catch(() => undefined);
  }

  // A visit that has passed is recorded straight from booked: confirm it first, since the API needs that step.
  async function recordOutcome(status: 'completed' | 'no_show') {
    try {
      if (appointment.status === 'booked') await updateStatus.mutateAsync({ id: appointment.id, status: 'confirmed' });
      await updateStatus.mutateAsync({ id: appointment.id, status });
    } catch {
      // The error is shown from the mutation state below.
    }
  }

  const actions = NEXT[appointment.status] ?? [];
  const error = errorText(updateStatus.error ?? retry.error);
  const canRetry = appointment.prediction?.riskLevel === 'unknown' && ['booked', 'confirmed'].includes(appointment.status);

  return (
    <div className={`flex gap-1.5 ${align === 'start' ? 'flex-wrap justify-start' : 'justify-end'}`}>
      {appointment.needsOutcome ? (
        <>
          <button className="btn btn-sm btn-success" disabled={busy} onClick={() => recordOutcome('completed')}>
            {busy ? 'Saving…' : 'Attended'}
          </button>
          <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => recordOutcome('no_show')}>No-show</button>
          <button className="btn btn-sm btn-secondary" disabled={busy} onClick={() => change('cancelled')}>Cancel</button>
        </>
      ) : (
        actions.map((action) => (
          <button key={action.status} className={`btn btn-sm ${action.tone}`} disabled={busy}
            onClick={() => change(action.status)}>{action.label}</button>
        ))
      )}
      {canRetry && (
        <button className="btn btn-sm btn-secondary" disabled={busy} onClick={() => retry.mutate(appointment.id)}>Retry score</button>
      )}
      {error && <span className="text-body text-coral" role="alert">{error}</span>}
    </div>
  );
}

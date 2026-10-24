import type { Appointment, AppointmentStatus } from '../../api/types';
import { useRetryPredictionMutation, useUpdateAppointmentStatusMutation } from '../../api/endpoints';
import { errorText } from '../../lib/format';

// Mirrors the backend's allowed transitions; completed, no-show and cancelled are final.
const NEXT: Partial<Record<AppointmentStatus, { status: AppointmentStatus; label: string; tone?: string }[]>> = {
  booked: [
    { status: 'confirmed', label: 'Confirm' },
    { status: 'cancelled', label: 'Cancel', tone: 'danger' },
  ],
  confirmed: [
    { status: 'completed', label: 'Attended', tone: 'success' },
    { status: 'no_show', label: 'No-show', tone: 'danger' },
    { status: 'cancelled', label: 'Cancel', tone: 'danger' },
  ],
};

export function AppointmentActions({ appointment }: { appointment: Appointment }) {
  const [updateStatus, statusState] = useUpdateAppointmentStatusMutation();
  const [retry, retryState] = useRetryPredictionMutation();
  const busy = statusState.isLoading || retryState.isLoading;

  async function change(status: AppointmentStatus) {
    if (status === 'cancelled' && !window.confirm('Cancel this appointment? Its reminders are cancelled and the slot is freed.')) return;
    await updateStatus({ id: appointment.id, status, patientId: appointment.patientId });
  }

  // A visit that has passed is recorded straight from booked: confirm it first, since the API needs that step.
  async function recordOutcome(status: 'completed' | 'no_show') {
    if (appointment.status === 'booked') {
      const confirmed = await updateStatus({ id: appointment.id, status: 'confirmed', patientId: appointment.patientId });
      if (!('data' in confirmed)) return;
    }
    await updateStatus({ id: appointment.id, status, patientId: appointment.patientId });
  }

  const actions = NEXT[appointment.status] ?? [];
  const error = errorText(statusState.error ?? retryState.error);

  return (
    <div className="row-actions">
      {appointment.needsOutcome ? (
        <>
          <button className="btn small success" disabled={busy} onClick={() => recordOutcome('completed')}>Attended</button>
          <button className="btn small danger" disabled={busy} onClick={() => recordOutcome('no_show')}>No-show</button>
          <button className="btn ghost small" disabled={busy} onClick={() => change('cancelled')}>Cancel</button>
        </>
      ) : (
        actions.map((action) => (
          <button key={action.status} className={`btn small ${action.tone ?? 'ghost'}`} disabled={busy}
            onClick={() => change(action.status)}>{action.label}</button>
        ))
      )}
      {appointment.prediction?.riskLevel === 'unknown' && ['booked', 'confirmed'].includes(appointment.status) && (
        <button className="btn ghost small" disabled={busy} onClick={() => retry(appointment.id)}>Retry score</button>
      )}
      {error && <span className="error-inline" role="alert">{error}</span>}
    </div>
  );
}

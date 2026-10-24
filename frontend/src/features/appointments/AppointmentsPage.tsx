import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { AppointmentQuery } from '../../api/endpoints';
import { useGetAppointmentsQuery } from '../../api/endpoints';
import type { AppointmentStatus, RiskLevel } from '../../api/types';
import { EmptyRow, ErrorNote, PageHeader, Pager, StatusBadge } from '../../components/ui';
import { errorText, formatDateTime } from '../../lib/format';
import { RiskBadge } from '../predictions/RiskBadge';
import { AppointmentActions } from './AppointmentActions';
import { BookAppointmentForm } from './BookAppointmentForm';

type View = 'upcoming' | 'outcome' | 'all';

const VIEWS: { id: View; label: string }[] = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'outcome', label: 'Needs outcome' },
  { id: 'all', label: 'All' },
];

export function AppointmentsPage() {
  const [params, setParams] = useSearchParams();
  const view = (params.get('view') as View) || 'upcoming';
  const risk = (params.get('risk') as RiskLevel) || undefined;
  const status = (params.get('status') as AppointmentStatus) || undefined;
  const bookFor = params.get('book');
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);
  // Fixed per visit so the upcoming query keeps a stable cache key.
  const [now] = useState(() => new Date().toISOString());

  const query: AppointmentQuery = { page, riskLevel: risk, status };
  // Upcoming means still open: cancelled and already-recorded visits are not coming up.
  if (view === 'upcoming') Object.assign(query, { from: now, order: 'asc', status: status ?? 'booked,confirmed' });
  if (view === 'outcome') Object.assign(query, { needsOutcome: true, order: 'asc' });
  // Polling picks up scores the background worker refreshes after an attendance outcome.
  const { data, error, isFetching } = useGetAppointmentsQuery(query, { pollingInterval: 20_000 });

  function setParam(key: string, value: string | undefined) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
    setPage(1);
  }

  return (
    <>
      <PageHeader title="Appointments" subtitle="Bookings, no-show risk and visit outcomes."
        action={!bookFor && <button className="btn primary" onClick={() => setParam('book', 'new')}>Book appointment</button>} />

      {bookFor && (
        <BookAppointmentForm initialPatientId={bookFor === 'new' ? undefined : bookFor}
          onCancel={() => setParam('book', undefined)}
          onBooked={(appointment) => {
            setParam('book', undefined);
            setNotice(`Booked ${appointment.patient.name} for ${formatDateTime(appointment.scheduledAt)}.`);
          }} />
      )}
      {notice && <p className="callout success" role="status">{notice}</p>}

      <section className="card">
        <div className="toolbar">
          <div className="tabs" role="tablist">
            {VIEWS.map((item) => (
              <button key={item.id} role="tab" aria-selected={view === item.id}
                className={`tab ${view === item.id ? 'active' : ''}`} onClick={() => setParam('view', item.id)}>
                {item.label}
              </button>
            ))}
          </div>
          <select value={risk ?? ''} onChange={(e) => setParam('risk', e.target.value || undefined)} aria-label="Risk">
            <option value="">Any risk</option>
            <option value="high">High risk</option>
            <option value="low">Low risk</option>
            <option value="new_patient">New patient</option>
            <option value="unknown">Not scored</option>
          </select>
          <select value={status ?? ''} onChange={(e) => setParam('status', e.target.value || undefined)} aria-label="Status">
            <option value="">Any status</option>
            <option value="booked">Booked</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Attended</option>
            <option value="no_show">No-show</option>
            <option value="cancelled">Cancelled</option>
          </select>
          {isFetching && <span className="muted">Refreshing…</span>}
        </div>
        {view === 'outcome' && (
          <p className="muted small-print">
            These visits have started but nobody recorded whether the patient came. Each answer updates the patient's
            history and re-scores their upcoming appointments.
          </p>
        )}
        <ErrorNote message={errorText(error)} />
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>When</th><th>Patient</th><th>Doctor</th><th>Risk</th><th>Status</th><th aria-label="Actions" /></tr>
            </thead>
            <tbody>
              {data?.data.length === 0 && (
                <EmptyRow colSpan={6}>{view === 'outcome' ? 'All caught up — every past visit has an outcome.' : 'No appointments match.'}</EmptyRow>
              )}
              {data?.data.map((appointment) => (
                <tr key={appointment.id} className={appointment.needsOutcome ? 'row-warn' : undefined}>
                  <td>
                    {formatDateTime(appointment.scheduledAt)}
                    <div className="muted">{appointment.durationMinutes} min</div>
                  </td>
                  <td><Link to={`/patients/${appointment.patient.id}`}>{appointment.patient.name}</Link></td>
                  <td>{appointment.doctor.user.email}<div className="muted">{appointment.doctor.specialty}</div></td>
                  <td><RiskBadge prediction={appointment.prediction} /></td>
                  <td><StatusBadge status={appointment.status} needsOutcome={appointment.needsOutcome} /></td>
                  <td><AppointmentActions appointment={appointment} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager pagination={data?.pagination} onPage={setPage} />
      </section>
    </>
  );
}

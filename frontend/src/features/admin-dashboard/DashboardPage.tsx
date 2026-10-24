import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useGetAppointmentsQuery, useGetPatientsQuery } from '../../api/endpoints';
import { EmptyRow, ErrorNote, PageHeader, StatusBadge } from '../../components/ui';
import { errorText, formatDateTime } from '../../lib/format';
import { RiskBadge } from '../predictions/RiskBadge';

function Stat({ label, value, hint, to, tone }: { label: string; value?: number; hint: string; to: string; tone?: string }) {
  return (
    <Link to={to} className={`card stat ${tone ?? ''}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value ?? '—'}</span>
      <span className="muted">{hint}</span>
    </Link>
  );
}

export function DashboardPage() {
  // Fixed per visit, so the "upcoming" queries keep a stable cache key instead of refetching every render.
  const [now] = useState(() => new Date().toISOString());
  const upcoming = { from: now, status: 'booked' as const, order: 'asc' as const };

  const needsOutcome = useGetAppointmentsQuery({ needsOutcome: true, limit: 1 });
  const highRisk = useGetAppointmentsQuery({ ...upcoming, riskLevel: 'high', limit: 8 }, { pollingInterval: 30_000 });
  const newPatients = useGetAppointmentsQuery({ ...upcoming, riskLevel: 'new_patient', limit: 1 });
  const patients = useGetPatientsQuery({ limit: 1 });

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Who needs attention before their next visit." />
      <ErrorNote message={errorText(highRisk.error ?? needsOutcome.error)} />

      <section className="stats">
        <Stat label="Needs outcome" value={needsOutcome.data?.pagination.total} tone="warn"
          hint="Past visits nobody has marked yet" to="/appointments?view=outcome" />
        <Stat label="High-risk upcoming" value={highRisk.data?.pagination.total} tone="danger"
          hint="Booked, not yet confirmed" to="/appointments?view=upcoming&risk=high" />
        <Stat label="New patients upcoming" value={newPatients.data?.pagination.total} tone="info"
          hint="No history yet, not scored" to="/appointments?view=upcoming&risk=new_patient" />
        <Stat label="Patients" value={patients.data?.pagination.total} hint="Enrolled in total" to="/patients" />
      </section>

      <section className="card">
        <div className="card-title">
          <h2>Next high-risk appointments</h2>
          <span className="muted">Call or confirm these first</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>When</th><th>Patient</th><th>Doctor</th><th>Risk</th><th>Status</th></tr>
            </thead>
            <tbody>
              {highRisk.isLoading && <EmptyRow colSpan={5}>Loading…</EmptyRow>}
              {highRisk.data?.data.length === 0 && <EmptyRow colSpan={5}>No high-risk bookings coming up.</EmptyRow>}
              {highRisk.data?.data.map((appointment) => (
                <tr key={appointment.id}>
                  <td>{formatDateTime(appointment.scheduledAt)}</td>
                  <td><Link to={`/patients/${appointment.patient.id}`}>{appointment.patient.name}</Link></td>
                  <td>{appointment.doctor.user.email}<div className="muted">{appointment.doctor.specialty}</div></td>
                  <td><RiskBadge prediction={appointment.prediction} /></td>
                  <td><StatusBadge status={appointment.status} needsOutcome={appointment.needsOutcome} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

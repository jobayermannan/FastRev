import { Link, useParams } from 'react-router-dom';
import { useGetRiskProfileQuery } from '../../api/endpoints';
import { useAppSelector } from '../../app/hooks';
import { EmptyRow, ErrorNote, PageHeader, StatusBadge } from '../../components/ui';
import { ageFrom, errorText, formatDate, formatDateTime, formatPercent } from '../../lib/format';
import { RiskBadge } from '../predictions/RiskBadge';

export function PatientDetailPage() {
  const { id = '' } = useParams();
  const isAdmin = useAppSelector((state) => state.auth.user?.role === 'admin');
  const { data, error, isLoading } = useGetRiskProfileQuery(id);

  if (isLoading) return <p className="muted">Loading…</p>;
  if (!data) return <ErrorNote message={errorText(error) ?? 'Patient not found.'} />;

  const { patient, attendance, upcomingAppointments } = data.data;

  return (
    <>
      <PageHeader title={patient.name}
        subtitle={`${patient.phone} · born ${formatDate(patient.dateOfBirth)} (${ageFrom(patient.dateOfBirth)})`}
        action={isAdmin && <Link className="btn primary" to={`/appointments?book=${patient.id}`}>Book appointment</Link>} />

      {attendance.isNewPatient && (
        <p className="callout info">
          <strong>New patient.</strong> No visit has been recorded yet, so FastRev does not guess a risk score.
          Upcoming appointments are scored automatically once the first visit is marked attended or no-show.
        </p>
      )}

      <section className="stats">
        <div className="card stat"><span className="stat-label">Attended</span><span className="stat-value">{attendance.completed}</span></div>
        <div className="card stat danger"><span className="stat-label">No-shows</span><span className="stat-value">{attendance.noShows}</span></div>
        <div className="card stat">
          <span className="stat-label">No-show rate</span>
          <span className="stat-value">{formatPercent(attendance.noShowRate)}</span>
          <span className="muted">Of visits with a recorded outcome</span>
        </div>
        <div className="card stat warn">
          <span className="stat-label">Needs outcome</span>
          <span className="stat-value">{attendance.awaitingOutcome}</span>
          <span className="muted">{attendance.cancelled} cancelled · {attendance.totalAppointments} booked in total</span>
        </div>
      </section>

      <section className="card">
        <div className="card-title"><h2>Upcoming appointments</h2></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>When</th><th>Risk</th><th>Status</th></tr></thead>
            <tbody>
              {upcomingAppointments.length === 0 && <EmptyRow colSpan={3}>Nothing booked.</EmptyRow>}
              {upcomingAppointments.map((appointment) => (
                <tr key={appointment.id}>
                  <td>{formatDateTime(appointment.scheduledAt)}</td>
                  <td><RiskBadge prediction={appointment.prediction} /></td>
                  <td><StatusBadge status={appointment.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

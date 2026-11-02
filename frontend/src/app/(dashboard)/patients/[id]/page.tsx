'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { RiskBadge } from '@/components/RiskBadge';
import { Callout, EmptyRow, ErrorNote, PageHeader, StatusBadge, TableWrap } from '@/components/ui';
import { useRiskProfile } from '@/lib/api/hooks';
import { useCurrentUser } from '@/lib/auth/store';
import { ageFrom, errorText, formatDate, formatDateTime, formatPercent } from '@/lib/format';

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const isAdmin = useCurrentUser()?.role === 'admin';
  const { data, error, isPending } = useRiskProfile(id);

  if (isPending) {
    return (
      <>
        <span className="skeleton h-8 w-56" />
        <span className="skeleton mt-3 h-4 w-80" />
        <span className="skeleton mt-8 h-44 w-full rounded-lg" />
      </>
    );
  }
  if (!data) return <ErrorNote message={errorText(error) ?? 'Patient not found.'} />;

  const { patient, attendance, upcomingAppointments } = data.data;

  return (
    <>
      <p className="mb-3"><Link href="/patients">← Patients</Link></p>
      <PageHeader title={patient.name}
        subtitle={`${patient.phone} · born ${formatDate(patient.dateOfBirth)} (${ageFrom(patient.dateOfBirth)} yrs)`}
        action={isAdmin && <Link className="btn btn-primary no-underline" href={`/appointments?book=${patient.id}`}>Book appointment</Link>} />

      {attendance.isNewPatient && (
        <Callout>
          <strong className="font-medium">New patient.</strong> No visit has been recorded yet, so FastRev does not
          guess a risk score. Upcoming appointments are scored automatically once the first visit is marked
          attended or no-show.
        </Callout>
      )}

      {/*
        Attendance is this patient's history, so it reads as one record on a single surface rather
        than four cards that happen to sit side by side. The rate leads because it is the figure the
        model scores on; the counts behind it stay in the sentence under it.
      */}
      <section className="band-cream mb-10">
        <p className="text-label font-medium">No-show rate</p>
        <p className="text-figure tnum mt-2">{formatPercent(attendance.noShowRate)}</p>
        <p className="mt-3 max-w-prose">
          {attendance.completed} attended · {attendance.noShows} missed
          {attendance.cancelled > 0 && <> · {attendance.cancelled} cancelled</>}
          {' '}of {attendance.totalAppointments} booked.
        </p>
        {attendance.awaitingOutcome > 0 && (
          <p className="meta mt-1.5">
            {attendance.awaitingOutcome} past {attendance.awaitingOutcome === 1 ? 'visit has' : 'visits have'} no
            outcome recorded, so this rate is still incomplete.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-4">Upcoming appointments</h2>
        <div className="card">
          <TableWrap>
            <table>
              <thead><tr><th>When</th><th>Risk</th><th>Status</th></tr></thead>
              <tbody>
                {upcomingAppointments.length === 0 && <EmptyRow colSpan={3}>Nothing booked.</EmptyRow>}
                {upcomingAppointments.map((appointment) => (
                  <tr key={appointment.id}>
                    {/* Only three columns here, so letting the date wrap on a phone keeps status on screen. */}
                    <td className="sm:whitespace-nowrap">{formatDateTime(appointment.scheduledAt)}</td>
                    <td><RiskBadge prediction={appointment.prediction} /></td>
                    <td><StatusBadge status={appointment.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </div>
      </section>
    </>
  );
}

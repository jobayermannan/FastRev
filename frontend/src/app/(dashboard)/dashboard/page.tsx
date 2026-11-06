'use client';

import Link from 'next/link';
import { useState } from 'react';
import { RiskBadge, StandbyBadge } from '@/components/RiskBadge';
import { RoleGate } from '@/components/RoleGate';
import { EmptyRow, ErrorNote, PageHeader, SkeletonRows, StatusBadge, TableWrap } from '@/components/ui';
import { useAppointments } from '@/lib/api/hooks';
import type { Appointment } from '@/lib/api/types';
import { errorText, formatDateTime } from '@/lib/format';

export default function DashboardPage() {
  return (
    <RoleGate roles={['admin']}>
      <Dashboard />
    </RoleGate>
  );
}

/**
 * This screen is a worklist, not a metrics wall. A clinic opens it to find out who to call and
 * what to record — so the two things that need a person carry the page, and the lists under the
 * band are the work itself rather than a summary of it.
 */
function Dashboard() {
  // Fixed per visit, so the "upcoming" queries keep a stable cache key instead of changing every render.
  const [now] = useState(() => new Date().toISOString());
  // Matches the Appointments "Upcoming" tab, so a count and the list it links to agree.
  const upcoming = { from: now, status: 'booked,confirmed' as const, order: 'asc' as const };

  const outcome = useAppointments({ needsOutcome: true, order: 'asc', limit: 5 }, { refetchInterval: 30_000 });
  const highRisk = useAppointments({ ...upcoming, riskLevel: 'high', limit: 5 }, { refetchInterval: 30_000 });

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Who needs a call, and what still needs recording." />
      <ErrorNote message={errorText(outcome.error ?? highRisk.error)} />

      <section className="band-dark mb-10 grid gap-10 sm:grid-cols-2">
        <Demand
          figure={outcome.data?.pagination.total}
          loading={outcome.isPending}
          title="Waiting on an outcome"
          body="These visits have started and nobody recorded whether the patient came. Each answer re-scores their next appointment."
          href="/appointments?view=outcome"
          action="Record outcomes"
          settled="Every past visit has an outcome."
        />
        <Demand
          figure={highRisk.data?.pagination.total}
          loading={highRisk.isPending}
          title="High risk, still open"
          body="Predicted to miss their appointment and not confirmed yet. Smart Overbooking suggests standby patients for these slots to protect clinic capacity."
          href="/appointments?view=upcoming&risk=high"
          action="See them"
          settled="Nothing high-risk is coming up."
        />
      </section>

      <Worklist
        title="Waiting on an outcome"
        query={outcome}
        href="/appointments?view=outcome"
        empty="All caught up — every past visit has an outcome."
      />
      <Worklist
        title="High risk, still open"
        query={highRisk}
        href="/appointments?view=upcoming&risk=high"
        empty="No high-risk bookings coming up."
      />
    </>
  );
}

function Demand({ figure, loading, title, body, href, action, settled }: {
  figure?: number; loading: boolean; title: string; body: string;
  href: string; action: string; settled: string;
}) {
  const done = figure === 0;
  return (
    <div className="flex flex-col items-start gap-3">
      <span className="text-label font-medium">{title}</span>
      {loading
        ? <span className="skeleton h-12 w-20 bg-white/20" />
        : <span className="text-figure tnum font-normal">{figure ?? '—'}</span>}
      <p className="meta max-w-prose">{done ? settled : body}</p>
      {!done && <Link className="btn btn-sm mt-1 border-canvas bg-canvas text-ink no-underline hover:bg-surface-strong" href={href}>{action}</Link>}
    </div>
  );
}

function Worklist({ title, query, href, empty }: {
  title: string;
  query: { data?: { data: Appointment[] }; isPending: boolean };
  href: string;
  empty: string;
}) {
  return (
    <section className="mb-10 last:mb-0">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2>{title}</h2>
        <Link className="text-body" href={href}>See all</Link>
      </div>
      <div className="card">
        <TableWrap>
          <table>
            <thead>
              <tr><th>When</th><th>Patient</th><th>Doctor</th><th>Risk</th><th>Status</th></tr>
            </thead>
            <tbody>
              {query.isPending && <SkeletonRows columns={5} rows={3} />}
              {query.data?.data.length === 0 && <EmptyRow colSpan={5}>{empty}</EmptyRow>}
              {query.data?.data.map((appointment) => (
                <tr key={appointment.id}>
                  <td className="whitespace-nowrap">{formatDateTime(appointment.scheduledAt)}</td>
                  <td className="whitespace-nowrap">
                    <Link href={`/patients/${appointment.patient.id}`}>{appointment.patient.name}</Link>
                  </td>
                  <td className="whitespace-nowrap">
                    {appointment.doctor.user.email}
                    <span className="meta block">{appointment.doctor.specialty}</span>
                  </td>
                  <td>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <RiskBadge prediction={appointment.prediction} />
                      {appointment.prediction?.riskLevel === 'high' && ['booked', 'confirmed'].includes(appointment.status) && (
                        <StandbyBadge probability={appointment.prediction?.noShowProbability} />
                      )}
                    </div>
                  </td>
                  <td><StatusBadge status={appointment.status} needsOutcome={appointment.needsOutcome} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </div>
    </section>
  );
}

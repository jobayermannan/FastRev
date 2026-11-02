'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { RiskBadge } from '@/components/RiskBadge';
import { RoleGate } from '@/components/RoleGate';
import { Callout, EmptyRow, ErrorNote, PageHeader, Pager, SkeletonRows, StatusBadge, TableWrap } from '@/components/ui';
import { useAppointments } from '@/lib/api/hooks';
import type { AppointmentQuery, AppointmentStatus, RiskLevel } from '@/lib/api/types';
import { errorText, formatDateTime } from '@/lib/format';
import { AppointmentActions } from './AppointmentActions';
import { BookAppointmentForm } from './BookAppointmentForm';

type View = 'upcoming' | 'outcome' | 'all';

const VIEWS: { id: View; label: string }[] = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'outcome', label: 'Needs outcome' },
  { id: 'all', label: 'All' },
];

export default function AppointmentsPage() {
  return (
    <RoleGate roles={['admin']}>
      {/* useSearchParams needs a Suspense boundary so the rest of the route can be prerendered. */}
      <Suspense fallback={<p className="muted">Loading…</p>}>
        <Appointments />
      </Suspense>
    </RoleGate>
  );
}

function Appointments() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const view = (params.get('view') as View | null) ?? 'upcoming';
  const risk = (params.get('risk') as RiskLevel | null) ?? undefined;
  const status = (params.get('status') as AppointmentStatus | null) ?? undefined;
  const bookFor = params.get('book');
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState<string | null>(null);
  // Fixed per visit so the upcoming query keeps a stable cache key.
  const [now] = useState(() => new Date().toISOString());

  const query: AppointmentQuery = { page, riskLevel: risk, status };
  // Upcoming means still open: cancelled and already-recorded visits are not coming up.
  if (view === 'upcoming') Object.assign(query, { from: now, order: 'asc', status: status ?? 'booked,confirmed' });
  // Needing an outcome already implies booked or confirmed, so a status filter here only ever contradicts it.
  if (view === 'outcome') Object.assign(query, { needsOutcome: true, order: 'asc', status: undefined });
  const { data, error, isPending, isFetching } = useAppointments(query, { refetchInterval: 20_000 });

  function setParam(key: string, value: string | undefined) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value); else next.delete(key);
    const text = next.toString();
    router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false });
    setPage(1);
  }

  return (
    <>
      <PageHeader title="Appointments" subtitle="Bookings, no-show risk and visit outcomes."
        action={!bookFor && <button className="btn btn-primary" onClick={() => setParam('book', 'new')}>Book appointment</button>} />

      {bookFor && (
        <BookAppointmentForm initialPatientId={bookFor === 'new' ? undefined : bookFor}
          onCancel={() => setParam('book', undefined)}
          onBooked={(appointment) => {
            setParam('book', undefined);
            setNotice(`Booked ${appointment.patient.name} for ${formatDateTime(appointment.scheduledAt)}.`);
          }} />
      )}
      {notice && <Callout tone="success">{notice}</Callout>}

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="inline-flex gap-0.5 rounded-sm border border-hairline p-0.5" role="tablist">
          {VIEWS.map((item) => (
            <button key={item.id} role="tab" aria-selected={view === item.id}
              className={`rounded-xs px-3 py-1.5 text-body transition-colors ${view === item.id
                ? 'bg-ink font-medium text-canvas'
                : 'text-muted hover:text-ink'}`}
              onClick={() => setParam('view', item.id)}>
              {item.label}
            </button>
          ))}
        </div>
        <select className="input w-auto" value={risk ?? ''} onChange={(e) => setParam('risk', e.target.value || undefined)} aria-label="Risk">
          <option value="">Any risk</option>
          <option value="high">High risk</option>
          <option value="low">Low risk</option>
          <option value="new_patient">New patient</option>
          <option value="unknown">Not scored</option>
        </select>
        <select className="input w-auto" value={view === 'outcome' ? '' : status ?? ''} disabled={view === 'outcome'}
          title={view === 'outcome' ? 'This view already shows only visits still waiting on an outcome.' : undefined}
          onChange={(e) => setParam('status', e.target.value || undefined)} aria-label="Status">
          <option value="">Any status</option>
          <option value="booked">Booked</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Attended</option>
          <option value="no_show">No-show</option>
          <option value="cancelled">Cancelled</option>
        </select>
        {isFetching && !isPending && <span className="meta">Refreshing…</span>}
      </div>

      {view === 'outcome' && (
        <p className="muted mb-5 max-w-prose">
          These visits have started but nobody recorded whether the patient came. Each answer updates the
          patient&apos;s history and re-scores their upcoming appointments.
        </p>
      )}
      <ErrorNote message={errorText(error)} />

      {/* A six-column table sends Risk, Status and the actions off a phone screen, so narrow
          viewports get the same rows stacked instead of a sideways scroll. */}
      <section className="flex flex-col gap-3 md:hidden">
        {isPending && [0, 1, 2].map((row) => (
          <div key={row} className="card flex flex-col gap-3" aria-hidden>
            <span className="skeleton h-4 w-40" />
            <span className="skeleton h-4 w-28" />
            <span className="skeleton h-7 w-full" />
          </div>
        ))}
        {data?.data.length === 0 && (
          <p className="card text-center text-muted">
            {view === 'outcome' ? 'All caught up — every past visit has an outcome.' : 'No appointments match.'}
          </p>
        )}
        {data?.data.map((appointment) => (
          <article key={appointment.id} className="card flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium text-ink">{formatDateTime(appointment.scheduledAt)}</span>
              <span className="meta tnum">{appointment.durationMinutes} min</span>
            </div>
            <div>
              <Link href={`/patients/${appointment.patient.id}`}>{appointment.patient.name}</Link>
              <span className="meta block">
                {appointment.doctor.user.email} · {appointment.doctor.specialty}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <RiskBadge prediction={appointment.prediction} />
              <StatusBadge status={appointment.status} needsOutcome={appointment.needsOutcome} />
            </div>
            <AppointmentActions appointment={appointment} align="start" />
          </article>
        ))}
        <Pager pagination={data?.pagination} onPage={setPage} />
      </section>

      <section className="card hidden md:block">
        <TableWrap>
          <table>
            <thead>
              <tr><th>When</th><th>Patient</th><th>Doctor</th><th>Risk</th><th>Status</th><th aria-label="Actions" /></tr>
            </thead>
            <tbody>
              {isPending && <SkeletonRows columns={6} rows={6} />}
              {data?.data.length === 0 && (
                <EmptyRow colSpan={6}>{view === 'outcome' ? 'All caught up — every past visit has an outcome.' : 'No appointments match.'}</EmptyRow>
              )}
              {data?.data.map((appointment) => (
                <tr key={appointment.id}>
                  <td className="whitespace-nowrap">
                    {formatDateTime(appointment.scheduledAt)}
                    <span className="meta tnum block">{appointment.durationMinutes} min</span>
                  </td>
                  <td className="whitespace-nowrap"><Link href={`/patients/${appointment.patient.id}`}>{appointment.patient.name}</Link></td>
                  <td className="whitespace-nowrap">
                    {appointment.doctor.user.email}
                    <span className="meta block">{appointment.doctor.specialty}</span>
                  </td>
                  <td><RiskBadge prediction={appointment.prediction} /></td>
                  <td><StatusBadge status={appointment.status} needsOutcome={appointment.needsOutcome} /></td>
                  {/* Actions keep one row height; the table scrolls rather than stacking buttons. */}
                  <td className="whitespace-nowrap"><AppointmentActions appointment={appointment} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
        <Pager pagination={data?.pagination} onPage={setPage} />
      </section>
    </>
  );
}

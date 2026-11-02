import type { ReactNode } from 'react';
import type { AppointmentStatus, Pagination } from '@/lib/api/types';

const STATUS_STYLES: Record<AppointmentStatus, { label: string; className: string }> = {
  booked: { label: 'Booked', className: 'badge-neutral' },
  confirmed: { label: 'Confirmed', className: 'badge-info' },
  completed: { label: 'Attended', className: 'badge-success' },
  // The only status that should interrupt a scan down the column.
  no_show: { label: 'No-show', className: 'badge-alert' },
  cancelled: { label: 'Cancelled', className: 'badge-quiet line-through' },
};

export function StatusBadge({ status, needsOutcome }: { status: AppointmentStatus; needsOutcome?: boolean }) {
  const style = STATUS_STYLES[status];
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      <span className={`badge ${style.className}`}>{style.label}</span>
      {needsOutcome && (
        <span className="badge badge-attention" title="The time has passed. Record whether the patient came.">
          Needs outcome
        </span>
      )}
    </span>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-prose">
        <h1>{title}</h1>
        {subtitle && <p className="muted mt-1.5">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function ErrorNote({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <p className="mb-4 rounded-sm border border-coral px-4 py-2.5 text-body text-coral" role="alert">{message}</p>
  );
}

export function Callout({ tone = 'info', children }: { tone?: 'info' | 'success'; children: ReactNode }) {
  const styles = tone === 'success' ? 'bg-mint text-forest' : 'bg-cream text-ink';
  return <div className={`mb-6 rounded-md px-5 py-4 text-body ${styles}`} role="status">{children}</div>;
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="border-b-0 py-12 text-center text-muted">{children}</td>
    </tr>
  );
}

/** Loading rows that match the real table's shape, so nothing jumps when the data lands. */
export function SkeletonRows({ columns, rows = 5 }: { columns: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, row) => (
        <tr key={row} aria-hidden>
          {Array.from({ length: columns }, (_, column) => (
            <td key={column}>
              <span className="skeleton h-4" style={{ width: column === 0 ? '7rem' : column === columns - 1 ? '3rem' : '5rem' }} />
            </td>
          ))}
        </tr>
      ))}
      <tr className="sr-only"><td colSpan={columns}>Loading…</td></tr>
    </>
  );
}

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="-mx-6 overflow-x-auto px-6">{children}</div>;
}

export function Pager({ pagination, onPage }: { pagination?: Pagination; onPage: (page: number) => void }) {
  if (!pagination || pagination.totalPages <= 1) return null;
  const { page, totalPages, total } = pagination;
  return (
    <nav className="mt-6 flex items-center justify-between gap-3 border-t border-hairline pt-4" aria-label="Pagination">
      <button className="btn btn-sm btn-secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
      <span className="meta tnum">Page {page} of {totalPages} · {total} total</span>
      <button className="btn btn-sm btn-secondary" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Next</button>
    </nav>
  );
}

export function FullPageMessage({ children }: { children: ReactNode }) {
  return <main className="flex min-h-screen flex-col items-center justify-center p-6 text-center text-muted">{children}</main>;
}

/** `inverted` is for the dark signature surface, where the mark's fill and knockout swap. */
export function BrandMark({ large = false, inverted = false }: { large?: boolean; inverted?: boolean }) {
  return (
    <span className={`flex items-center gap-2.5 font-medium ${inverted ? 'text-canvas' : 'text-ink'} ${large ? 'text-section' : 'text-label'}`}>
      <svg aria-hidden viewBox="0 0 24 24" className={large ? 'h-8 w-8' : 'h-6 w-6'} fill="none">
        <rect width="24" height="24" rx="6" fill="currentColor" />
        <path d="M8 7.5h8M8 12h8M8 16.5h4.5" stroke={inverted ? '#181d26' : '#fff'} strokeWidth="1.75" strokeLinecap="round" />
      </svg>
      FastRev
    </span>
  );
}

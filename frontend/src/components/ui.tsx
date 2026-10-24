import type { ReactNode } from 'react';
import type { AppointmentStatus, Pagination } from '../api/types';

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  booked: 'Booked',
  confirmed: 'Confirmed',
  completed: 'Attended',
  no_show: 'No-show',
  cancelled: 'Cancelled',
};

export function StatusBadge({ status, needsOutcome }: { status: AppointmentStatus; needsOutcome?: boolean }) {
  return (
    <span className="status-cell">
      <span className={`badge status-${status}`}>{STATUS_LABELS[status]}</span>
      {needsOutcome && <span className="badge needs-outcome" title="The time has passed. Record whether the patient came.">Needs outcome</span>}
    </span>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="error-note" role="alert">{message}</p>;
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="empty">{children}</td>
    </tr>
  );
}

export function Pager({ pagination, onPage }: { pagination?: Pagination; onPage: (page: number) => void }) {
  if (!pagination || pagination.totalPages <= 1) return null;
  const { page, totalPages, total } = pagination;
  return (
    <nav className="pager" aria-label="Pagination">
      <button className="btn ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
      <span className="muted">Page {page} of {totalPages} · {total} total</span>
      <button className="btn ghost" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Next</button>
    </nav>
  );
}

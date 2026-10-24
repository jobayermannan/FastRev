import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Patient } from '../../api/types';
import { useDeletePatientMutation, useGetPatientsQuery } from '../../api/endpoints';
import { useAppSelector } from '../../app/hooks';
import { EmptyRow, ErrorNote, PageHeader, Pager } from '../../components/ui';
import { ageFrom, errorText, formatDate } from '../../lib/format';
import { PatientForm } from './PatientForm';

export function PatientsPage() {
  const isAdmin = useAppSelector((state) => state.auth.user?.role === 'admin');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Patient | 'new' | null>(null);
  const { data, isFetching, error } = useGetPatientsQuery({ page, search: debounced });
  const [deletePatient, deleteState] = useDeletePatientMutation();

  useEffect(() => {
    const timer = setTimeout(() => { setDebounced(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  async function remove(patient: Patient) {
    if (!window.confirm(`Delete ${patient.name}? This cannot be undone.`)) return;
    await deletePatient(patient.id);
  }

  const deleteError = deleteState.error && 'status' in deleteState.error && deleteState.error.status === 409
    ? 'This patient has appointments, so they cannot be deleted.'
    : errorText(deleteState.error);

  return (
    <>
      <PageHeader title="Patients" subtitle="Enrolled patients and their attendance history."
        action={isAdmin && !editing && <button className="btn primary" onClick={() => setEditing('new')}>Enroll patient</button>} />

      {editing && (
        <PatientForm key={editing === 'new' ? 'new' : editing.id} patient={editing === 'new' ? undefined : editing}
          onDone={() => setEditing(null)} />
      )}

      <section className="card">
        <div className="toolbar">
          <input type="search" placeholder="Search by name or phone" value={search} onChange={(e) => setSearch(e.target.value)}
            aria-label="Search patients" />
          {isFetching && <span className="muted">Loading…</span>}
        </div>
        <ErrorNote message={errorText(error) ?? deleteError} />
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Name</th><th>Phone</th><th>Born</th><th>Attended</th><th>No-shows</th><th aria-label="Actions" /></tr>
            </thead>
            <tbody>
              {data?.data.length === 0 && <EmptyRow colSpan={6}>{debounced ? 'No patients match.' : 'No patients enrolled yet.'}</EmptyRow>}
              {data?.data.map((patient) => {
                const isNew = patient.completedAppointmentCount + patient.priorNoShowCount === 0;
                return (
                  <tr key={patient.id}>
                    <td>
                      <Link to={`/patients/${patient.id}`}>{patient.name}</Link>
                      {isNew && <span className="badge risk-new_patient inline">New</span>}
                    </td>
                    <td>{patient.phone}</td>
                    <td>{formatDate(patient.dateOfBirth)} <span className="muted">({ageFrom(patient.dateOfBirth)})</span></td>
                    <td>{patient.completedAppointmentCount}</td>
                    <td className={patient.priorNoShowCount ? 'text-danger' : undefined}>{patient.priorNoShowCount}</td>
                    <td className="row-actions">
                      <Link className="btn ghost small" to={`/patients/${patient.id}`}>View</Link>
                      {isAdmin && <button className="btn ghost small" onClick={() => setEditing(patient)}>Edit</button>}
                      {isAdmin && <button className="btn ghost small danger" onClick={() => remove(patient)}>Delete</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pager pagination={data?.pagination} onPage={setPage} />
      </section>
    </>
  );
}

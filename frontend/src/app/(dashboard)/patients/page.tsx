'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { EmptyRow, ErrorNote, PageHeader, Pager, SkeletonRows, TableWrap } from '@/components/ui';
import { useDeletePatient, usePatients } from '@/lib/api/hooks';
import type { Patient } from '@/lib/api/types';
import { useCurrentUser } from '@/lib/auth/store';
import { ageFrom, errorText, formatDate, isStatus } from '@/lib/format';
import { PatientForm } from './PatientForm';

/** Admins and doctors can view patients; only admins enroll, edit or delete (enforced by the API too). */
export default function PatientsPage() {
  const isAdmin = useCurrentUser()?.role === 'admin';
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Patient | 'new' | null>(null);
  const { data, isPending, isFetching, error } = usePatients({ page, search: debounced });
  const deletePatient = useDeletePatient();

  useEffect(() => {
    const timer = setTimeout(() => { setDebounced(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  function remove(patient: Patient) {
    if (!window.confirm(`Delete ${patient.name}? This cannot be undone.`)) return;
    deletePatient.mutate(patient.id);
  }

  const deleteError = isStatus(deletePatient.error, 409)
    ? 'This patient has appointments, so they cannot be deleted.'
    : errorText(deletePatient.error);

  return (
    <>
      <PageHeader title="Patients" subtitle="Enrolled patients and their attendance history."
        action={isAdmin && !editing && <button className="btn btn-primary" onClick={() => setEditing('new')}>Enroll patient</button>} />

      {editing && (
        <PatientForm key={editing === 'new' ? 'new' : editing.id} patient={editing === 'new' ? undefined : editing}
          onDone={() => setEditing(null)} />
      )}

      <div className="mb-5 flex items-center gap-3">
        <input className="input max-w-sm" type="search" placeholder="Search by name or phone" value={search}
          onChange={(e) => setSearch(e.target.value)} aria-label="Search patients" />
        {isFetching && !isPending && <span className="meta">Searching…</span>}
      </div>
      <ErrorNote message={errorText(error) ?? deleteError} />

      <section className="card">
        <TableWrap>
          <table>
            <thead>
              <tr><th>Name</th><th>Phone</th><th>Born</th><th>Attended</th><th>No-shows</th><th aria-label="Actions" /></tr>
            </thead>
            <tbody>
              {isPending && <SkeletonRows columns={6} rows={6} />}
              {data?.data.length === 0 && <EmptyRow colSpan={6}>{debounced ? 'No patients match.' : 'No patients enrolled yet.'}</EmptyRow>}
              {data?.data.map((patient) => {
                const isNew = patient.completedAppointmentCount + patient.priorNoShowCount === 0;
                return (
                  <tr key={patient.id}>
                    <td className="whitespace-nowrap">
                      <Link href={`/patients/${patient.id}`}>{patient.name}</Link>
                      {isNew && <span className="badge badge-new ml-2">New</span>}
                    </td>
                    <td className="tnum whitespace-nowrap">{patient.phone}</td>
                    <td className="whitespace-nowrap">
                      {formatDate(patient.dateOfBirth)}
                      <span className="meta tnum"> · {ageFrom(patient.dateOfBirth)} yrs</span>
                    </td>
                    <td>{patient.completedAppointmentCount}</td>
                    <td className={patient.priorNoShowCount ? 'font-medium text-coral' : undefined}>{patient.priorNoShowCount}</td>
                    {/* The name is already the link to the record, so the row needs no View button —
                        just the two edits, quiet enough not to compete with the data. */}
                    <td className="whitespace-nowrap">
                      {isAdmin && (
                        <div className="flex justify-end gap-1">
                          <button className="btn btn-sm btn-quiet" onClick={() => setEditing(patient)}>Edit</button>
                          <button className="btn btn-sm btn-quiet hover:text-coral" onClick={() => remove(patient)}>Delete</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
        <Pager pagination={data?.pagination} onPage={setPage} />
      </section>
    </>
  );
}

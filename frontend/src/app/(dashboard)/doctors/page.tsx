'use client';

import { useState, type FormEvent } from 'react';
import { RoleGate } from '@/components/RoleGate';
import { EmptyRow, ErrorNote, PageHeader, Pager, SkeletonRows, TableWrap } from '@/components/ui';
import { useCreateDoctor, useDeleteDoctor, useDoctors, useUpdateDoctor } from '@/lib/api/hooks';
import type { Doctor } from '@/lib/api/types';
import { errorText, isStatus } from '@/lib/format';

export default function DoctorsPage() {
  return (
    <RoleGate roles={['admin']}>
      <Doctors />
    </RoleGate>
  );
}

function DoctorForm({ onDone }: { onDone: () => void }) {
  const create = useCreateDoctor();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [specialty, setSpecialty] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate({ email: email.trim(), password, specialty: specialty.trim() }, { onSuccess: onDone });
  }

  const message = isStatus(create.error, 409) ? 'An account with this email already exists.' : errorText(create.error);

  return (
    <form className="panel mb-8 grid gap-5 sm:grid-cols-3" onSubmit={submit}>
      <h2 className="sm:col-span-3">Add a doctor</h2>
      <label className="field">
        Email (used to sign in)
        <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="field">
        Temporary password
        <input className="input" type="password" required minLength={8} autoComplete="new-password" value={password}
          onChange={(e) => setPassword(e.target.value)} />
      </label>
      <label className="field">
        Specialty
        <input className="input" required maxLength={191} placeholder="e.g. Cardiology" value={specialty}
          onChange={(e) => setSpecialty(e.target.value)} />
      </label>
      <div className="sm:col-span-3">
        <ErrorNote message={message} />
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={onDone}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={create.isPending}>
            {create.isPending ? 'Saving…' : 'Add doctor'}
          </button>
        </div>
      </div>
    </form>
  );
}

function SpecialtyCell({ doctor }: { doctor: Doctor }) {
  const update = useUpdateDoctor();
  const [value, setValue] = useState<string | null>(null);

  if (value === null) {
    return (
      <span className="inline-flex items-center gap-2">
        {doctor.specialty}
        <button className="btn btn-sm btn-quiet" onClick={() => setValue(doctor.specialty)}>Edit</button>
      </span>
    );
  }

  function save(event: FormEvent) {
    event.preventDefault();
    update.mutate({ id: doctor.id, specialty: (value ?? '').trim() }, { onSuccess: () => setValue(null) });
  }

  return (
    <form className="flex flex-wrap items-center gap-2" onSubmit={save}>
      <input className="input w-48" required autoFocus maxLength={191} value={value}
        onChange={(e) => setValue(e.target.value)} aria-label="Specialty" />
      <button className="btn btn-sm btn-primary" disabled={update.isPending}>
        {update.isPending ? 'Saving…' : 'Save'}
      </button>
      <button type="button" className="btn btn-sm btn-secondary" onClick={() => setValue(null)}>Cancel</button>
      <ErrorNote message={errorText(update.error)} />
    </form>
  );
}

function Doctors() {
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const { data, error, isPending } = useDoctors({ page });
  const deleteDoctor = useDeleteDoctor();

  function remove(doctor: Doctor) {
    if (!window.confirm(`Remove ${doctor.user.email}? Their login is deleted too.`)) return;
    deleteDoctor.mutate(doctor.id);
  }

  const deleteError = isStatus(deleteDoctor.error, 409)
    ? 'This doctor has appointments, so they cannot be removed.'
    : errorText(deleteDoctor.error);

  return (
    <>
      <PageHeader title="Doctors" subtitle="Each doctor gets their own login and can view patients."
        action={!adding && <button className="btn btn-primary" onClick={() => setAdding(true)}>Add doctor</button>} />
      {adding && <DoctorForm onDone={() => setAdding(false)} />}
      <ErrorNote message={errorText(error) ?? deleteError} />
      <section className="card">
        <TableWrap>
          <table>
            <thead><tr><th>Email</th><th>Specialty</th><th aria-label="Actions" /></tr></thead>
            <tbody>
              {isPending && <SkeletonRows columns={3} rows={4} />}
              {data?.data.length === 0 && <EmptyRow colSpan={3}>No doctors yet. Add one to start booking.</EmptyRow>}
              {data?.data.map((doctor) => (
                <tr key={doctor.id}>
                  <td>{doctor.user.email}</td>
                  <td><SpecialtyCell doctor={doctor} /></td>
                  <td className="whitespace-nowrap text-right">
                    <button className="btn btn-sm btn-quiet hover:text-coral" onClick={() => remove(doctor)}>Remove</button>
                  </td>
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

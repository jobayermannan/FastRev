import { useState, type FormEvent } from 'react';
import type { Doctor } from '../../api/types';
import { useCreateDoctorMutation, useDeleteDoctorMutation, useGetDoctorsQuery, useUpdateDoctorMutation } from '../../api/endpoints';
import { EmptyRow, ErrorNote, PageHeader, Pager } from '../../components/ui';
import { errorText } from '../../lib/format';

function DoctorForm({ onDone }: { onDone: () => void }) {
  const [create, { isLoading, error }] = useCreateDoctorMutation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [specialty, setSpecialty] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await create({ email: email.trim(), password, specialty: specialty.trim() });
    if ('data' in result) onDone();
  }

  const message = error && 'status' in error && error.status === 409
    ? 'An account with this email already exists.'
    : errorText(error);

  return (
    <form className="card form-grid" onSubmit={submit}>
      <h2 className="span-all">Add a doctor</h2>
      <label>
        Email (used to sign in)
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label>
        Temporary password
        <input type="password" required minLength={8} autoComplete="new-password" value={password}
          onChange={(e) => setPassword(e.target.value)} />
      </label>
      <label>
        Specialty
        <input required maxLength={191} placeholder="e.g. Cardiology" value={specialty} onChange={(e) => setSpecialty(e.target.value)} />
      </label>
      <div className="span-all">
        <ErrorNote message={message} />
        <div className="actions">
          <button type="button" className="btn ghost" onClick={onDone}>Cancel</button>
          <button type="submit" className="btn primary" disabled={isLoading}>{isLoading ? 'Saving…' : 'Add doctor'}</button>
        </div>
      </div>
    </form>
  );
}

function SpecialtyCell({ doctor }: { doctor: Doctor }) {
  const [update, { isLoading, error }] = useUpdateDoctorMutation();
  const [value, setValue] = useState<string | null>(null);

  if (value === null) {
    return (
      <span className="inline-edit">
        {doctor.specialty}
        <button className="btn ghost small" onClick={() => setValue(doctor.specialty)}>Edit</button>
      </span>
    );
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    const result = await update({ id: doctor.id, specialty: value!.trim() });
    if ('data' in result) setValue(null);
  }
  return (
    <form className="inline-edit" onSubmit={save}>
      <input required autoFocus maxLength={191} value={value} onChange={(e) => setValue(e.target.value)} aria-label="Specialty" />
      <button className="btn primary small" disabled={isLoading}>Save</button>
      <button type="button" className="btn ghost small" onClick={() => setValue(null)}>Cancel</button>
      <ErrorNote message={errorText(error)} />
    </form>
  );
}

export function DoctorsPage() {
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const { data, error } = useGetDoctorsQuery({ page });
  const [deleteDoctor, deleteState] = useDeleteDoctorMutation();

  async function remove(doctor: Doctor) {
    if (!window.confirm(`Remove ${doctor.user.email}? Their login is deleted too.`)) return;
    await deleteDoctor(doctor.id);
  }

  const deleteError = deleteState.error && 'status' in deleteState.error && deleteState.error.status === 409
    ? 'This doctor has appointments, so they cannot be removed.'
    : errorText(deleteState.error);

  return (
    <>
      <PageHeader title="Doctors" subtitle="Each doctor gets their own login and can view patients."
        action={!adding && <button className="btn primary" onClick={() => setAdding(true)}>Add doctor</button>} />
      {adding && <DoctorForm onDone={() => setAdding(false)} />}
      <section className="card">
        <ErrorNote message={errorText(error) ?? deleteError} />
        <div className="table-wrap">
          <table>
            <thead><tr><th>Email</th><th>Specialty</th><th aria-label="Actions" /></tr></thead>
            <tbody>
              {data?.data.length === 0 && <EmptyRow colSpan={3}>No doctors yet. Add one to start booking.</EmptyRow>}
              {data?.data.map((doctor) => (
                <tr key={doctor.id}>
                  <td>{doctor.user.email}</td>
                  <td><SpecialtyCell doctor={doctor} /></td>
                  <td className="row-actions">
                    <button className="btn ghost small danger" onClick={() => remove(doctor)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager pagination={data?.pagination} onPage={setPage} />
      </section>
    </>
  );
}

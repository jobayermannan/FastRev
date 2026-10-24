import { useRef, useState, type FormEvent } from 'react';
import type { Patient } from '../../api/types';
import { useCreatePatientMutation, useUpdatePatientMutation } from '../../api/endpoints';
import { ErrorNote } from '../../components/ui';
import { errorText } from '../../lib/format';

/** Creates a patient, or edits one when `patient` is given. */
export function PatientForm({ patient, onDone }: { patient?: Patient; onDone: () => void }) {
  const [create, createState] = useCreatePatientMutation();
  const [update, updateState] = useUpdatePatientMutation();
  const [name, setName] = useState(patient?.name ?? '');
  const [phone, setPhone] = useState(patient?.phone ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(patient?.dateOfBirth.slice(0, 10) ?? '');
  // One key per form, so a double-click or a retried request cannot enroll the same patient twice.
  const idempotencyKey = useRef(crypto.randomUUID());
  const state = patient ? updateState : createState;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const body = { name: name.trim(), phone: phone.trim(), dateOfBirth };
    const result = patient
      ? await update({ id: patient.id, body })
      : await create({ body, idempotencyKey: idempotencyKey.current });
    if ('data' in result) onDone();
  }

  return (
    <form className="card form-grid" onSubmit={submit}>
      <h2 className="span-all">{patient ? `Edit ${patient.name}` : 'Enroll a patient'}</h2>
      <label>
        Full name
        <input required value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        Phone
        <input required minLength={7} type="tel" placeholder="+8801…" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </label>
      <label>
        Date of birth
        <input required type="date" max={new Date().toISOString().slice(0, 10)} value={dateOfBirth}
          onChange={(e) => setDateOfBirth(e.target.value)} />
      </label>
      <div className="span-all">
        <ErrorNote message={errorText(state.error)} />
        <div className="actions">
          <button type="button" className="btn ghost" onClick={onDone}>Cancel</button>
          <button type="submit" className="btn primary" disabled={state.isLoading}>
            {state.isLoading ? 'Saving…' : patient ? 'Save changes' : 'Enroll patient'}
          </button>
        </div>
      </div>
    </form>
  );
}

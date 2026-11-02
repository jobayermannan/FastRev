'use client';

import { useRef, useState, type FormEvent } from 'react';
import { ErrorNote } from '@/components/ui';
import { useCreatePatient, useUpdatePatient } from '@/lib/api/hooks';
import type { Patient } from '@/lib/api/types';
import { errorText } from '@/lib/format';

/** Creates a patient, or edits one when `patient` is given. */
export function PatientForm({ patient, onDone }: { patient?: Patient; onDone: () => void }) {
  const create = useCreatePatient();
  const update = useUpdatePatient();
  const [name, setName] = useState(patient?.name ?? '');
  const [phone, setPhone] = useState(patient?.phone ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(patient?.dateOfBirth.slice(0, 10) ?? '');
  // One key per form, so a double-click or a retried request cannot enroll the same patient twice.
  const idempotencyKey = useRef<string | null>(null);
  const state = patient ? update : create;

  function submit(event: FormEvent) {
    event.preventDefault();
    const body = { name: name.trim(), phone: phone.trim(), dateOfBirth };
    if (patient) {
      update.mutate({ id: patient.id, body }, { onSuccess: onDone });
    } else {
      idempotencyKey.current ??= crypto.randomUUID();
      create.mutate({ body, idempotencyKey: idempotencyKey.current }, { onSuccess: onDone });
    }
  }

  return (
    <form className="panel mb-8 grid gap-5 sm:grid-cols-3" onSubmit={submit}>
      <h2 className="sm:col-span-3">{patient ? `Edit ${patient.name}` : 'Enroll a patient'}</h2>
      <label className="field">
        Full name
        <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field">
        Phone
        <input className="input" required minLength={7} type="tel" placeholder="+8801…" value={phone}
          onChange={(e) => setPhone(e.target.value)} />
      </label>
      <label className="field">
        Date of birth
        <input className="input" required type="date" max={new Date().toISOString().slice(0, 10)} value={dateOfBirth}
          onChange={(e) => setDateOfBirth(e.target.value)} />
      </label>
      <div className="sm:col-span-3">
        <ErrorNote message={errorText(state.error)} />
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={onDone}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={state.isPending}>
            {state.isPending ? 'Saving…' : patient ? 'Save changes' : 'Enroll patient'}
          </button>
        </div>
      </div>
    </form>
  );
}

'use client';

import { useRef, useState, type FormEvent } from 'react';
import { ErrorNote } from '@/components/ui';
import { useCreateAppointment, useDoctors, usePatient, usePatients } from '@/lib/api/hooks';
import type { Appointment } from '@/lib/api/types';
import { errorText, isStatus, localInputToIso, nowForInput } from '@/lib/format';

const DURATIONS = [15, 30, 45, 60, 90];

export function BookAppointmentForm({ initialPatientId, onBooked, onCancel }: {
  initialPatientId?: string;
  onBooked: (appointment: Appointment) => void;
  onCancel: () => void;
}) {
  const create = useCreateAppointment();
  const [patientSearch, setPatientSearch] = useState('');
  const patients = usePatients({ limit: 100, search: patientSearch.trim() });
  const doctors = useDoctors({ limit: 100 });
  const [patientId, setPatientId] = useState(initialPatientId ?? '');
  // The list is one page deep and can be filtered, so the chosen patient may be missing from it.
  const chosen = usePatient(patientId || undefined).data?.data;
  const options = patients.data?.data ?? [];
  const missing = chosen && !options.some((patient) => patient.id === chosen.id) ? chosen : null;
  const [doctorId, setDoctorId] = useState('');
  const [when, setWhen] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(30);
  // One key per booking attempt, so a retry after a network blip cannot double-book.
  const idempotencyKey = useRef<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    idempotencyKey.current ??= crypto.randomUUID();
    create.mutate({
      body: { patientId, doctorId, scheduledAt: localInputToIso(when), durationMinutes },
      idempotencyKey: idempotencyKey.current,
    }, {
      onSuccess: ({ data }) => {
        idempotencyKey.current = null;
        onBooked(data);
      },
    });
  }

  const message = isStatus(create.error, 409)
    ? 'That doctor is already booked for part of this time. Pick another time or doctor.'
    : errorText(create.error);
  const noDoctors = doctors.data?.data.length === 0;

  return (
    <form className="panel mb-8 grid gap-5 sm:grid-cols-2" onSubmit={submit}>
      <h2 className="sm:col-span-2">Book an appointment</h2>
      <label className="field">
        Patient
        <input className="input" type="search" placeholder="Filter patients" value={patientSearch}
          onChange={(e) => setPatientSearch(e.target.value)} aria-label="Filter patients" />
        <select className="input mt-1.5" required value={patientId} onChange={(e) => setPatientId(e.target.value)}>
          <option value="">Choose a patient…</option>
          {missing && <option value={missing.id}>{missing.name} · {missing.phone}</option>}
          {options.map((patient) => (
            <option key={patient.id} value={patient.id}>{patient.name} · {patient.phone}</option>
          ))}
        </select>
      </label>
      <label className="field">
        Doctor
        <select className="input" required value={doctorId} onChange={(e) => setDoctorId(e.target.value)} disabled={noDoctors}>
          <option value="">{noDoctors ? 'Add a doctor first' : 'Choose a doctor…'}</option>
          {doctors.data?.data.map((doctor) => (
            <option key={doctor.id} value={doctor.id}>{doctor.user.email} · {doctor.specialty}</option>
          ))}
        </select>
      </label>
      <label className="field">
        Date and time
        <input className="input" type="datetime-local" required min={nowForInput(1)} step={60} value={when}
          onChange={(e) => setWhen(e.target.value)} />
      </label>
      <label className="field">
        Duration
        <select className="input" value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))}>
          {DURATIONS.map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}
        </select>
      </label>
      <div className="sm:col-span-2">
        <p className="muted mb-4 max-w-prose">
          FastRev scores the no-show risk as soon as it&apos;s booked and schedules reminders to match.
        </p>
        <ErrorNote message={message} />
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={create.isPending}>
            {create.isPending ? 'Booking…' : 'Book appointment'}
          </button>
        </div>
      </div>
    </form>
  );
}

import { useRef, useState, type FormEvent } from 'react';
import { useCreateAppointmentMutation, useGetDoctorsQuery, useGetPatientsQuery } from '../../api/endpoints';
import type { Appointment } from '../../api/types';
import { ErrorNote } from '../../components/ui';
import { errorText, localInputToIso, nowForInput } from '../../lib/format';

const DURATIONS = [15, 30, 45, 60, 90];

export function BookAppointmentForm({ initialPatientId, onBooked, onCancel }: {
  initialPatientId?: string;
  onBooked: (appointment: Appointment) => void;
  onCancel: () => void;
}) {
  const [create, { isLoading, error }] = useCreateAppointmentMutation();
  const [patientSearch, setPatientSearch] = useState('');
  const patients = useGetPatientsQuery({ limit: 100, search: patientSearch.trim() });
  const doctors = useGetDoctorsQuery({ limit: 100 });
  const [patientId, setPatientId] = useState(initialPatientId ?? '');
  const [doctorId, setDoctorId] = useState('');
  const [when, setWhen] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(30);
  // One key per booking attempt, so a retry after a network blip cannot double-book.
  const idempotencyKey = useRef(crypto.randomUUID());

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await create({
      body: { patientId, doctorId, scheduledAt: localInputToIso(when), durationMinutes },
      idempotencyKey: idempotencyKey.current,
    });
    if ('data' in result && result.data) {
      idempotencyKey.current = crypto.randomUUID();
      onBooked(result.data.data);
    }
  }

  const message = error && 'status' in error && error.status === 409
    ? 'That doctor is already booked for part of this time. Pick another time or doctor.'
    : errorText(error);
  const noDoctors = doctors.data && doctors.data.data.length === 0;

  return (
    <form className="card form-grid" onSubmit={submit}>
      <h2 className="span-all">Book an appointment</h2>
      <label>
        Patient
        <input type="search" placeholder="Filter patients" value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)}
          aria-label="Filter patients" />
        <select required value={patientId} onChange={(e) => setPatientId(e.target.value)}>
          <option value="">Choose a patient…</option>
          {patients.data?.data.map((patient) => (
            <option key={patient.id} value={patient.id}>{patient.name} · {patient.phone}</option>
          ))}
        </select>
      </label>
      <label>
        Doctor
        <select required value={doctorId} onChange={(e) => setDoctorId(e.target.value)} disabled={noDoctors}>
          <option value="">{noDoctors ? 'Add a doctor first' : 'Choose a doctor…'}</option>
          {doctors.data?.data.map((doctor) => (
            <option key={doctor.id} value={doctor.id}>{doctor.user.email} · {doctor.specialty}</option>
          ))}
        </select>
      </label>
      <label>
        Date and time
        <input type="datetime-local" required min={nowForInput(1)} step={60} value={when} onChange={(e) => setWhen(e.target.value)} />
      </label>
      <label>
        Duration
        <select value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))}>
          {DURATIONS.map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}
        </select>
      </label>
      <div className="span-all">
        <p className="muted small-print">
          FastRev scores the no-show risk as soon as it's booked and schedules reminders to match.
        </p>
        <ErrorNote message={message} />
        <div className="actions">
          <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn primary" disabled={isLoading}>{isLoading ? 'Booking…' : 'Book appointment'}</button>
        </div>
      </div>
    </form>
  );
}

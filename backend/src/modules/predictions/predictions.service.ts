import axios from 'axios';
import { z } from 'zod';
import prisma from '../../common/prisma';
import { AppError } from '../../common/middleware/errorHandler';
import { env } from '../../common/config/env';
import { logger } from '../../common/logger';

const predictResponseSchema = z.object({
  appointment_id: z.string(),
  no_show_probability: z.number().min(0).max(1),
  risk_level: z.enum(['low', 'high']),
  model_version: z.string().min(1),
});

type PredictionValues = { noShowProbability: number | null; riskLevel: string; modelVersion: string };

const NEW_PATIENT: PredictionValues = { noShowProbability: null, riskLevel: 'new_patient', modelVersion: 'new-patient' };
const UNKNOWN: PredictionValues = { noShowProbability: null, riskLevel: 'unknown', modelVersion: 'unavailable' };

function ageOn(dateOfBirth: Date, scheduledAt: Date) {
  let age = scheduledAt.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  if (scheduledAt.getUTCMonth() < dateOfBirth.getUTCMonth() ||
    (scheduledAt.getUTCMonth() === dateOfBirth.getUTCMonth() &&
      scheduledAt.getUTCDate() < dateOfBirth.getUTCDate())) age--;
  return Math.max(0, age);
}

/**
 * Scores an appointment and stores the result. `needsRetry` is true when the AI service could not
 * be reached, so the caller should queue another attempt.
 */
export async function scoreAppointment(appointmentId: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { patient: true, doctor: true, prediction: true },
  });
  if (!appointment) throw new AppError(404, 'Appointment not found');

  const save = (values: PredictionValues) => prisma.prediction.upsert({
    where: { appointmentId },
    create: { appointmentId, ...values },
    update: values,
  });

  const { patient } = appointment;
  const pastOutcomes = patient.completedAppointmentCount + patient.priorNoShowCount;
  // Without a single recorded show or no-show there is no history to score, so label the patient instead.
  if (pastOutcomes === 0) {
    return { prediction: await save(NEW_PATIENT), needsRetry: false };
  }

  try {
    const response = await axios.post(`${env.AI_SERVICE_URL}/predict/no-show-risk`, {
      appointment_id: appointment.id,
      patient_age: ageOn(patient.dateOfBirth, appointment.scheduledAt),
      prior_no_show_count: patient.priorNoShowCount,
      total_appointment_count: pastOutcomes,
      days_until_appointment: Math.max(0, Math.ceil(
        (appointment.scheduledAt.getTime() - appointment.createdAt.getTime()) / 86_400_000,
      )),
      hour_of_day: appointment.scheduledAt.getUTCHours(),
      specialty: appointment.doctor.specialty,
    }, { timeout: env.AI_PREDICT_TIMEOUT_MS });
    const parsed = predictResponseSchema.parse(response.data);
    if (parsed.appointment_id !== appointment.id) throw new Error('Prediction appointment mismatch');
    const prediction = await save({
      noShowProbability: parsed.no_show_probability,
      riskLevel: parsed.risk_level,
      modelVersion: parsed.model_version,
    });
    return { prediction, needsRetry: false };
  } catch (err) {
    logger.warn({ appointmentId, errorName: err instanceof Error ? err.name : 'Unknown' },
      'Prediction unavailable');
    // An outage must not erase a real score this appointment already has.
    if (appointment.prediction && ['low', 'high'].includes(appointment.prediction.riskLevel)) {
      return { prediction: appointment.prediction, needsRetry: true };
    }
    return { prediction: await save(UNKNOWN), needsRetry: true };
  }
}

import { Prisma } from '@prisma/client';
import prisma from '../../common/prisma';
import { AppError } from '../../common/middleware/errorHandler';
import { buildPaginationMeta } from '../../common/utils/pagination';
import { AppointmentQuery, AppointmentStatus, CreateAppointmentInput } from './appointments.schema';
import { scoreAppointment } from '../predictions/predictions.service';
import { logger } from '../../common/logger';
import { enqueuePredictionRefresh, enqueuePredictionRetry } from '../../worker/queues';
import { cancelAppointmentReminders, scheduleAppointmentReminders } from '../notifications/notifications.service';

const appointmentSelect = {
  id: true,
  patientId: true,
  doctorId: true,
  scheduledAt: true,
  durationMinutes: true,
  status: true,
  createdAt: true,
  patient: { select: { id: true, name: true } },
  doctor: { select: { id: true, specialty: true, user: { select: { email: true } } } },
  prediction: true,
} as const;

const OPEN_STATUSES = ['booked', 'confirmed'];

// Once its start time has passed, an open appointment is waiting for staff to record whether the patient came.
function withOutcomeFlag<T extends { status: string; scheduledAt: Date }>(appointment: T) {
  return {
    ...appointment,
    needsOutcome: OPEN_STATUSES.includes(appointment.status) && appointment.scheduledAt <= new Date(),
  };
}

function slotKey(doctorId: string, scheduledAt: Date) {
  return `${doctorId}:${scheduledAt.toISOString().slice(0, 19)}`;
}

function matchesRequest(existing: { patientId: string; doctorId: string; scheduledAt: Date; durationMinutes: number },
  input: CreateAppointmentInput, scheduledAt: Date) {
  return existing.patientId === input.patientId && existing.doctorId === input.doctorId &&
    existing.scheduledAt.getTime() === scheduledAt.getTime() && existing.durationMinutes === input.durationMinutes;
}

export async function createAppointment(input: CreateAppointmentInput, idempotencyKey?: string) {
  const scheduledAt = new Date(input.scheduledAt);
  const end = new Date(scheduledAt.getTime() + input.durationMinutes * 60_000);

  const replay = async () => {
    if (!idempotencyKey) return null;
    const existing = await prisma.appointment.findUnique({ where: { idempotencyKey }, select: appointmentSelect });
    if (!existing) return null;
    if (!matchesRequest(existing, input, scheduledAt)) throw new AppError(409, 'Idempotency key was used for another request');
    return withOutcomeFlag(existing);
  };

  const existing = await replay();
  if (existing) return { appointment: existing, created: false };
  if (scheduledAt <= new Date() || !Number.isFinite(end.getTime()) ||
    scheduledAt.getUTCSeconds() !== 0 || scheduledAt.getUTCMilliseconds() !== 0) {
    throw new AppError(400, 'Appointment must have a valid future time');
  }

  try {
    const appointment = await prisma.$transaction(async (tx) => {
      // Lock the doctor row so concurrent bookings for this doctor check overlaps serially.
      const doctor = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM doctors WHERE id = ${input.doctorId} FOR UPDATE`;
      if (!doctor.length) throw new AppError(400, 'Doctor not found');

      const patient = await tx.patient.findUnique({ where: { id: input.patientId }, select: { id: true } });
      if (!patient) throw new AppError(400, 'Patient not found');

      const overlap = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM appointments
        WHERE doctor_id = ${input.doctorId}
          AND status <> 'cancelled'
          AND scheduled_at < ${end}
          AND DATE_ADD(scheduled_at, INTERVAL duration_minutes MINUTE) > ${scheduledAt}
        LIMIT 1
      `;
      if (overlap.length) throw new AppError(409, 'Doctor is already booked for this time');

      const created = await tx.appointment.create({
        data: {
          patientId: input.patientId,
          doctorId: input.doctorId,
          scheduledAt,
          durationMinutes: input.durationMinutes,
          activeSlotKey: slotKey(input.doctorId, scheduledAt),
          idempotencyKey,
        },
        select: appointmentSelect,
      });
      await tx.patient.update({
        where: { id: input.patientId }, data: { totalAppointmentCount: { increment: 1 } },
      });
      return created;
    });
    try {
      const { needsRetry } = await scoreAppointment(appointment.id);
      if (needsRetry) {
        await enqueuePredictionRetry(appointment.id);
      }
      await scheduleAppointmentReminders(appointment.id);
      return { appointment: await getAppointmentById(appointment.id), created: true };
    } catch (err) {
      logger.warn({ appointmentId: appointment.id, errorName: err instanceof Error ? err.name : 'Unknown' },
        'Prediction could not be saved after booking');
      return { appointment: withOutcomeFlag(appointment), created: true };
    }
  } catch (err) {
    if (idempotencyKey && err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const repeated = await replay();
      if (repeated) return { appointment: repeated, created: false };
    }
    throw err;
  }
}

export async function getAppointments(query: AppointmentQuery) {
  const { page, limit, status, riskLevel, from, to, needsOutcome, order } = query;
  const where: Prisma.AppointmentWhereInput = {};
  if (status) where.status = { in: status };
  if (riskLevel) where.prediction = { is: { riskLevel } };
  if (from || to) where.scheduledAt = {
    ...(from ? { gte: new Date(from) } : {}),
    ...(to ? { lte: new Date(to) } : {}),
  };
  if (needsOutcome !== undefined) {
    const awaitingOutcome = { status: { in: OPEN_STATUSES }, scheduledAt: { lte: new Date() } };
    if (needsOutcome) where.AND = [awaitingOutcome];
    else where.NOT = awaitingOutcome;
  }
  const [rows, total] = await Promise.all([
    prisma.appointment.findMany({
      where, skip: (page - 1) * limit, take: limit,
      orderBy: [{ scheduledAt: order }, { id: order }], select: appointmentSelect,
    }),
    prisma.appointment.count({ where }),
  ]);
  return { data: rows.map(withOutcomeFlag), pagination: buildPaginationMeta(total, page, limit) };
}

export async function getAppointmentById(id: string) {
  const appointment = await prisma.appointment.findUnique({ where: { id }, select: appointmentSelect });
  if (!appointment) throw new AppError(404, 'Appointment not found');
  return withOutcomeFlag(appointment);
}

export async function updateAppointmentStatus(id: string, status: AppointmentStatus) {
  const result = await prisma.$transaction(async (tx) => {
    // Serialize status changes for this appointment before checking its current state.
    await tx.$queryRaw`SELECT id FROM appointments WHERE id = ${id} FOR UPDATE`;
    const appointment = await tx.appointment.findUnique({ where: { id } });
    if (!appointment) throw new AppError(404, 'Appointment not found');

    const transitions: Record<string, AppointmentStatus[]> = {
      booked: ['confirmed', 'cancelled'],
      confirmed: ['completed', 'no_show', 'cancelled'],
    };
    if (!transitions[appointment.status]?.includes(status)) {
      throw new AppError(409, 'Invalid appointment status transition');
    }

    const updated = await tx.appointment.update({
      where: { id },
      data: { status, activeSlotKey: status === 'cancelled' ? null : appointment.activeSlotKey },
      select: appointmentSelect,
    });
    if (status === 'no_show') {
      await tx.patient.update({
        where: { id: appointment.patientId }, data: { priorNoShowCount: { increment: 1 } },
      });
    }
    if (status === 'completed') {
      await tx.patient.update({
        where: { id: appointment.patientId }, data: { completedAppointmentCount: { increment: 1 } },
      });
    }
    return { updated, patientId: appointment.patientId };
  });

  if (status === 'cancelled') {
    try {
      await cancelAppointmentReminders(id);
    } catch (err) {
      logger.warn({ appointmentId: id, errorName: err instanceof Error ? err.name : 'Unknown' },
        'Appointment reminders could not be cancelled');
    }
  }
  // Either outcome changes the patient's history, so their upcoming risk scores are refreshed.
  if (status === 'no_show' || status === 'completed') {
    await queueFutureAppointmentPredictions(result.patientId);
  }
  return withOutcomeFlag(result.updated);
}

async function queueFutureAppointmentPredictions(patientId: string) {
  try {
    const appointments = await prisma.appointment.findMany({
      where: {
        patientId,
        status: { in: OPEN_STATUSES },
        scheduledAt: { gt: new Date() },
      },
      select: { id: true },
    });
    await Promise.all(appointments.map(({ id }) => enqueuePredictionRefresh(id)));
  } catch (err) {
    logger.warn({ patientId, errorName: err instanceof Error ? err.name : 'Unknown' },
      'Future appointment risk refresh could not be queued');
  }
}

export async function retryAppointmentPrediction(id: string) {
  await getAppointmentById(id);
  const { needsRetry } = await scoreAppointment(id);
  if (needsRetry) {
    await enqueuePredictionRetry(id);
  } else {
    await scheduleAppointmentReminders(id);
  }
  return getAppointmentById(id);
}

import prisma from '../../common/prisma';
import { AppError } from '../../common/middleware/errorHandler';
import {
  CreatePatientInput,
  UpdatePatientInput,
  PatientQuery,
} from './patients.schema';
import { buildPaginationMeta } from '../../common/utils/pagination';
import { Prisma } from '@prisma/client';

const patientSelect = {
  id: true,
  userId: true,
  enrolledByAdminId: true,
  name: true,
  phone: true,
  dateOfBirth: true,
  priorNoShowCount: true,
  completedAppointmentCount: true,
  totalAppointmentCount: true,
  createdAt: true,
};

export async function createPatient(data: CreatePatientInput, enrolledByAdminId: string, idempotencyKey?: string) {
  if (data.userId) {
    const user = await prisma.user.findUnique({ where: { id: data.userId } });
    if (!user) {
      throw new AppError(400, 'User not found');
    }
  }

  const patient = await prisma.patient.create({
    data: {
      ...data,
      dateOfBirth: data.dateOfBirth,
      enrolledByAdminId,
      idempotencyKey,
    },
    select: patientSelect,
  });

  return patient;
}

export async function enrollPatient(data: CreatePatientInput, enrolledByAdminId: string, idempotencyKey?: string) {
  const replay = async () => {
    if (!idempotencyKey) return null;
    const existing = await prisma.patient.findUnique({ where: { idempotencyKey }, select: patientSelect });
    if (!existing) return null;
    if (existing.enrolledByAdminId !== enrolledByAdminId || existing.name !== data.name ||
      existing.phone !== data.phone || existing.userId !== (data.userId ?? null) ||
      existing.dateOfBirth.getTime() !== data.dateOfBirth.getTime()) {
      throw new AppError(409, 'Idempotency key was used for another request');
    }
    return existing;
  };

  const existing = await replay();
  if (existing) return { patient: existing, created: false };
  try {
    return { patient: await createPatient(data, enrolledByAdminId, idempotencyKey), created: true };
  } catch (err) {
    if (idempotencyKey && err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const repeated = await replay();
      if (repeated) return { patient: repeated, created: false };
    }
    throw err;
  }
}

export async function getPatients(query: PatientQuery) {
  const { search, sortBy, order, page, limit } = query;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { phone: { contains: search } },
    ];
  }

  const [patients, total] = await Promise.all([
    prisma.patient.findMany({
      where,
      orderBy: { [sortBy]: order },
      skip,
      take: limit,
      select: patientSelect,
    }),
    prisma.patient.count({ where }),
  ]);

  return {
    data: patients,
    pagination: buildPaginationMeta(total, page, limit),
  };
}

export async function getPatientById(id: string) {
  const patient = await prisma.patient.findUnique({
    where: { id },
    select: patientSelect,
  });

  if (!patient) {
    throw new AppError(404, 'Patient not found');
  }

  return patient;
}

export async function getPatientRiskProfile(id: string) {
  const [patient, appointments] = await Promise.all([
    prisma.patient.findUnique({ where: { id }, select: patientSelect }),
    prisma.appointment.findMany({
      where: { patientId: id },
      orderBy: { scheduledAt: 'desc' },
      select: {
        id: true,
        scheduledAt: true,
        status: true,
        prediction: { select: { noShowProbability: true, riskLevel: true, modelVersion: true } },
      },
    }),
  ]);
  if (!patient) throw new AppError(404, 'Patient not found');

  const statusCounts = appointments.reduce<Record<string, number>>((counts, appointment) => {
    counts[appointment.status] = (counts[appointment.status] ?? 0) + 1;
    return counts;
  }, {});
  // The rate counts only visits with a recorded outcome; cancelled and future bookings say nothing about attendance.
  const pastOutcomes = patient.completedAppointmentCount + patient.priorNoShowCount;
  const noShowRate = pastOutcomes === 0
    ? null
    : Number((patient.priorNoShowCount / pastOutcomes).toFixed(3));
  const now = new Date();
  const open = appointments.filter((appointment) => ['booked', 'confirmed'].includes(appointment.status));

  return {
    patient,
    attendance: {
      isNewPatient: pastOutcomes === 0,
      totalAppointments: patient.totalAppointmentCount,
      completed: patient.completedAppointmentCount,
      noShows: patient.priorNoShowCount,
      noShowRate,
      cancelled: statusCounts.cancelled ?? 0,
      awaitingOutcome: open.filter((appointment) => appointment.scheduledAt <= now).length,
    },
    upcomingAppointments: open.filter((appointment) => appointment.scheduledAt > now),
  };
}

export async function updatePatient(id: string, data: UpdatePatientInput) {
  const patient = await prisma.patient.update({
    where: { id },
    data: {
      ...data,
      dateOfBirth: data.dateOfBirth,
    },
    select: patientSelect,
  });

  return patient;
}

export async function deletePatient(id: string) {
  await prisma.patient.delete({ where: { id } });
}

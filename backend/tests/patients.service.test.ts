import { beforeEach, describe, it, expect, vi } from 'vitest';

const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    user: { findUnique: vi.fn() },
    patient: { create: vi.fn(), count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
    appointment: { findMany: vi.fn() },
  };
  return { mockPrisma };
});

vi.mock('../src/common/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

import { createPatient, enrollPatient, getPatientRiskProfile } from '../src/modules/patients/patients.service';
import { AppError } from '../src/common/middleware/errorHandler';

describe('patients.service', () => {
  beforeEach(() => vi.resetAllMocks());
  it('createPatient rejects invalid phone via Zod schema (controller boundary)', async () => {
    const { createPatientSchema } = await import('../src/modules/patients/patients.schema');
    expect(() => createPatientSchema.parse({ name: 'Jane', phone: '123', dateOfBirth: new Date() })).toThrow();
  });

  it('createPatient throws when userId does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(
      createPatient({ name: 'Jane', phone: '1234567890', dateOfBirth: new Date(), userId: 'missing' }, 'admin-1')
    ).rejects.toThrow(new AppError(400, 'User not found'));
  });

  it('createPatient creates patient with enrolledByAdminId', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' });
    mockPrisma.patient.create.mockResolvedValue({
      id: 'patient-1',
      name: 'Jane',
      phone: '1234567890',
      dateOfBirth: new Date(),
      userId: 'user-1',
      enrolledByAdminId: 'admin-1',
    });

    const result = await createPatient(
      { name: 'Jane', phone: '1234567890', dateOfBirth: new Date(), userId: 'user-1' },
      'admin-1'
    );

    expect(result.id).toBe('patient-1');
    expect(mockPrisma.patient.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ name: 'Jane', phone: '1234567890', enrolledByAdminId: 'admin-1' }),
      select: expect.any(Object),
    });
  });

  it('returns the original patient for a repeated enrollment key', async () => {
    const dateOfBirth = new Date('1990-01-01T00:00:00Z');
    mockPrisma.patient.findUnique.mockResolvedValue({
      id: 'patient-1', name: 'Jane', phone: '1234567890', dateOfBirth,
      userId: null, enrolledByAdminId: 'admin-1',
    });

    const result = await enrollPatient(
      { name: 'Jane', phone: '1234567890', dateOfBirth }, 'admin-1', 'request-1',
    );

    expect(result.created).toBe(false);
    expect(result.patient.id).toBe('patient-1');
    expect(mockPrisma.patient.create).not.toHaveBeenCalled();
  });

  it('returns attendance history and upcoming AI risk scores', async () => {
    mockPrisma.patient.findUnique.mockResolvedValue({
      id: 'patient-1', name: 'Jane', priorNoShowCount: 2, completedAppointmentCount: 6, totalAppointmentCount: 11,
    });
    mockPrisma.appointment.findMany.mockResolvedValue([
      {
        id: 'future-1', status: 'booked', scheduledAt: new Date(Date.now() + 86_400_000),
        prediction: { riskLevel: 'high', noShowProbability: 0.71, modelVersion: 'xgboost-v1' },
      },
      { id: 'past-open', status: 'confirmed', scheduledAt: new Date(Date.now() - 3_600_000), prediction: null },
      { id: 'past-1', status: 'completed', scheduledAt: new Date('2024-01-01'), prediction: null },
    ]);

    const profile = await getPatientRiskProfile('patient-1');

    // 2 no-shows out of 8 visits with an outcome; cancelled and future bookings are excluded.
    expect(profile.attendance).toMatchObject({
      isNewPatient: false, totalAppointments: 11, completed: 6, noShows: 2, noShowRate: 0.25, awaitingOutcome: 1,
    });
    expect(profile.upcomingAppointments.map((a) => a.id)).toEqual(['future-1']);
    expect(profile.upcomingAppointments[0].prediction?.riskLevel).toBe('high');
  });

  it('marks a patient with no recorded outcome as new, with no rate', async () => {
    mockPrisma.patient.findUnique.mockResolvedValue({
      id: 'patient-1', name: 'Jane', priorNoShowCount: 0, completedAppointmentCount: 0, totalAppointmentCount: 2,
    });
    mockPrisma.appointment.findMany.mockResolvedValue([]);

    const profile = await getPatientRiskProfile('patient-1');

    expect(profile.attendance).toMatchObject({ isNewPatient: true, noShowRate: null });
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma, tx, mockScore, mockQueueRetry, mockQueueRefresh, mockScheduleReminders, mockCancelReminders } = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    patient: { findUnique: vi.fn(), update: vi.fn() },
    appointment: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  };
  return {
    tx,
    mockScore: vi.fn(),
    mockQueueRetry: vi.fn(),
    mockQueueRefresh: vi.fn(),
    mockScheduleReminders: vi.fn(),
    mockCancelReminders: vi.fn(),
    mockPrisma: {
      $transaction: vi.fn(),
      appointment: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    },
  };
});

vi.mock('../src/common/prisma', () => ({ default: mockPrisma }));
vi.mock('../src/modules/predictions/predictions.service', () => ({ scoreAppointment: mockScore }));
vi.mock('../src/worker/queues', () => ({
  enqueuePredictionRetry: mockQueueRetry,
  enqueuePredictionRefresh: mockQueueRefresh,
}));
vi.mock('../src/modules/notifications/notifications.service', () => ({
  scheduleAppointmentReminders: mockScheduleReminders,
  cancelAppointmentReminders: mockCancelReminders,
}));

import {
  createAppointment, getAppointmentById, getAppointments, updateAppointmentStatus,
} from '../src/modules/appointments/appointments.service';

const future = new Date(Math.ceil((Date.now() + 86_400_000) / 60_000) * 60_000).toISOString();
const input = {
  patientId: 'patient-1', doctorId: 'doctor-1', scheduledAt: future, durationMinutes: 45,
};

beforeEach(() => {
  vi.resetAllMocks();
  mockPrisma.$transaction.mockImplementation((fn) => fn(tx));
  mockPrisma.appointment.findUnique.mockResolvedValue(null);
  tx.patient.findUnique.mockResolvedValue({ id: input.patientId });
  tx.patient.update.mockResolvedValue({});
  mockScore.mockResolvedValue({ prediction: { riskLevel: 'low' }, needsRetry: false });
  mockScheduleReminders.mockResolvedValue([]);
  mockCancelReminders.mockResolvedValue(undefined);
});

describe('appointment booking', () => {
  it('rejects a duration overlap before creating a booking', async () => {
    tx.$queryRaw.mockResolvedValueOnce([{ id: input.doctorId }]).mockResolvedValueOnce([{ id: 'existing' }]);

    await expect(createAppointment(input)).rejects.toMatchObject({ statusCode: 409 });
    expect(tx.appointment.create).not.toHaveBeenCalled();
  });

  it('creates one booking and scores it after the transaction', async () => {
    const created = { id: 'appointment-1', ...input, scheduledAt: new Date(future), prediction: null };
    tx.$queryRaw.mockResolvedValueOnce([{ id: input.doctorId }]).mockResolvedValueOnce([]);
    tx.appointment.create.mockResolvedValue(created);
    mockPrisma.appointment.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
      ...created, prediction: { riskLevel: 'low', noShowProbability: 0.25 },
    });

    const result = await createAppointment(input, 'request-1');

    expect(result.created).toBe(true);
    expect(result.appointment.prediction?.riskLevel).toBe('low');
    expect(tx.appointment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ durationMinutes: 45, idempotencyKey: 'request-1' }),
    }));
    expect(tx.patient.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { totalAppointmentCount: { increment: 1 } },
    }));
    expect(mockScore).toHaveBeenCalledWith('appointment-1');
  });

  it('returns the first result for an idempotent replay', async () => {
    mockPrisma.appointment.findUnique.mockResolvedValue({
      id: 'appointment-1', patientId: input.patientId, doctorId: input.doctorId,
      scheduledAt: new Date(future), durationMinutes: input.durationMinutes,
    });

    const result = await createAppointment(input, 'request-1');

    expect(result.created).toBe(false);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('queues a prediction retry when the AI service could not be reached', async () => {
    const created = { id: 'appointment-1', ...input, scheduledAt: new Date(future), prediction: null };
    tx.$queryRaw.mockResolvedValueOnce([{ id: input.doctorId }]).mockResolvedValueOnce([]);
    tx.appointment.create.mockResolvedValue(created);
    mockScore.mockResolvedValue({ prediction: { riskLevel: 'unknown' }, needsRetry: true });
    mockPrisma.appointment.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(created);

    await createAppointment(input);

    expect(mockQueueRetry).toHaveBeenCalledWith('appointment-1');
  });
});

describe('appointment status', () => {
  it('frees the slot on cancellation', async () => {
    tx.appointment.findUnique.mockResolvedValue({
      id: 'appointment-1', patientId: input.patientId, status: 'booked', activeSlotKey: 'occupied',
    });
    tx.appointment.update.mockResolvedValue({ id: 'appointment-1', status: 'cancelled' });

    await updateAppointmentStatus('appointment-1', 'cancelled');

    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(tx.appointment.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: 'cancelled', activeSlotKey: null },
    }));
    expect(mockCancelReminders).toHaveBeenCalledWith('appointment-1');
  });

  it('rejects a transition from a terminal status', async () => {
    tx.appointment.findUnique.mockResolvedValue({ id: 'appointment-1', status: 'completed' });

    await expect(updateAppointmentStatus('appointment-1', 'cancelled')).rejects.toMatchObject({ statusCode: 409 });
    expect(tx.appointment.update).not.toHaveBeenCalled();
  });

  it('queues future appointments after a patient no-show', async () => {
    tx.appointment.findUnique.mockResolvedValue({
      id: 'appointment-1', patientId: input.patientId, status: 'confirmed', activeSlotKey: 'occupied',
    });
    tx.appointment.update.mockResolvedValue({ id: 'appointment-1', status: 'no_show' });
    mockPrisma.appointment.findMany.mockResolvedValue([{ id: 'future-appointment' }]);

    await updateAppointmentStatus('appointment-1', 'no_show');

    expect(tx.patient.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { priorNoShowCount: { increment: 1 } },
    }));
    expect(mockQueueRefresh).toHaveBeenCalledWith('future-appointment');
  });

  it('counts a completed visit and refreshes future appointment scores', async () => {
    tx.appointment.findUnique.mockResolvedValue({
      id: 'appointment-1', patientId: input.patientId, status: 'confirmed', activeSlotKey: 'occupied',
    });
    tx.appointment.update.mockResolvedValue({ id: 'appointment-1', status: 'completed', scheduledAt: new Date() });
    mockPrisma.appointment.findMany.mockResolvedValue([{ id: 'future-appointment' }]);

    const result = await updateAppointmentStatus('appointment-1', 'completed');

    expect(tx.patient.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { completedAppointmentCount: { increment: 1 } },
    }));
    expect(mockQueueRefresh).toHaveBeenCalledWith('future-appointment');
    expect(result.needsOutcome).toBe(false);
  });
});

describe('appointments awaiting an outcome', () => {
  it('flags an open appointment whose start time has passed', async () => {
    mockPrisma.appointment.findUnique.mockResolvedValue({
      id: 'appointment-1', status: 'booked', scheduledAt: new Date(Date.now() - 3_600_000),
    });

    expect((await getAppointmentById('appointment-1')).needsOutcome).toBe(true);
  });

  it('does not flag a future or already-resolved appointment', async () => {
    mockPrisma.appointment.findUnique
      .mockResolvedValueOnce({ id: 'future', status: 'booked', scheduledAt: new Date(Date.now() + 3_600_000) })
      .mockResolvedValueOnce({ id: 'done', status: 'completed', scheduledAt: new Date(Date.now() - 3_600_000) });

    expect((await getAppointmentById('future')).needsOutcome).toBe(false);
    expect((await getAppointmentById('done')).needsOutcome).toBe(false);
  });

  it('filters the list to open appointments that have already started', async () => {
    mockPrisma.appointment.findMany.mockResolvedValue([]);
    mockPrisma.appointment.count.mockResolvedValue(0);

    await getAppointments({ page: 1, limit: 20, needsOutcome: true });

    expect(mockPrisma.appointment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { AND: [{ status: { in: ['booked', 'confirmed'] }, scheduledAt: { lte: expect.any(Date) } }] },
    }));
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPrisma, mockEnqueue, mockProvider } = vi.hoisted(() => ({
  mockPrisma: {
    appointment: { findUnique: vi.fn() },
    notification: { upsert: vi.fn(), updateMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
  mockEnqueue: vi.fn(),
  mockProvider: { send: vi.fn() },
}));

vi.mock('../src/common/prisma', () => ({ default: mockPrisma }));
vi.mock('../src/worker/queues', () => ({ enqueueNotificationDelivery: mockEnqueue }));
vi.mock('../src/worker/sms.provider', () => ({ getSmsProvider: () => mockProvider }));

import {
  cancelAppointmentReminders,
  deliverNotification,
  scheduleAppointmentReminders,
} from '../src/modules/notifications/notifications.service';

const appointment = {
  id: 'appointment-1',
  status: 'booked',
  scheduledAt: new Date(Date.now() + 72 * 3_600_000),
  createdAt: new Date(),
  prediction: { riskLevel: 'high' },
  patient: { phone: '+15550101' },
};

beforeEach(() => {
  vi.resetAllMocks();
  mockPrisma.appointment.findUnique.mockResolvedValue(appointment);
  mockPrisma.notification.upsert.mockImplementation(async ({ create }) => ({ id: create.dedupeKey, status: 'queued' }));
  mockEnqueue.mockResolvedValue({});
  mockProvider.send.mockResolvedValue({ providerMessageId: 'console-1' });
});

describe('reminder scheduling', () => {
  it('schedules the two high-risk reminders only once each', async () => {
    const result = await scheduleAppointmentReminders(appointment.id);

    expect(result).toHaveLength(2);
    expect(mockPrisma.notification.upsert).toHaveBeenCalledTimes(2);
    expect(mockEnqueue).toHaveBeenCalledTimes(2);
    expect(mockPrisma.notification.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ dedupeKey: 'appointment-1:sms:48h', type: 'high_risk_reminder' }),
    }));
  });

  it('gives a new patient booked far ahead an extra 48h reminder', async () => {
    mockPrisma.appointment.findUnique.mockResolvedValue({
      ...appointment, scheduledAt: new Date(Date.now() + 20 * 86_400_000), prediction: { riskLevel: 'new_patient' },
    });

    await scheduleAppointmentReminders(appointment.id);

    const keys = mockPrisma.notification.upsert.mock.calls.map(([args]) => args.create.dedupeKey);
    expect(keys).toEqual(['appointment-1:sms:48h', 'appointment-1:sms:24h']);
  });

  it('gives a new patient booked soon only the standard 24h reminder', async () => {
    mockPrisma.appointment.findUnique.mockResolvedValue({
      ...appointment, scheduledAt: new Date(Date.now() + 3 * 86_400_000), prediction: { riskLevel: 'new_patient' },
    });

    await scheduleAppointmentReminders(appointment.id);

    const keys = mockPrisma.notification.upsert.mock.calls.map(([args]) => args.create.dedupeKey);
    expect(keys).toEqual(['appointment-1:sms:24h']);
  });

  it('marks outstanding reminders cancelled', async () => {
    await cancelAppointmentReminders(appointment.id);

    expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
      where: { appointmentId: appointment.id, status: { in: ['queued', 'retrying'] } },
      data: { status: 'cancelled' },
    });
  });
});

describe('reminder delivery', () => {
  it('uses the configured provider and records a successful delivery', async () => {
    mockPrisma.notification.findUnique.mockResolvedValue({
      id: 'notification-1', status: 'queued',
      appointment: { ...appointment, patient: { phone: '+15550101', name: 'Test Patient' } },
    });

    await deliverNotification('notification-1');

    expect(mockProvider.send).toHaveBeenCalledWith(expect.objectContaining({ to: '+15550101' }));
    expect(mockPrisma.notification.update).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'sent', providerMessageId: 'console-1' }),
    }));
  });
});

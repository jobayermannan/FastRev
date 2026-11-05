import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockPost, mockPrisma, mockUpdateStatus, mockRemoveDelivery } = vi.hoisted(() => ({
  mockPost: vi.fn(),
  mockPrisma: {
    patient: { findMany: vi.fn() },
    appointment: { findFirst: vi.fn() },
    notification: { findMany: vi.fn() },
  },
  mockUpdateStatus: vi.fn(),
  mockRemoveDelivery: vi.fn(),
}));

vi.mock('axios', () => ({
  default: {
    post: mockPost,
    isAxiosError: (err: unknown) => Boolean((err as { isAxiosError?: boolean })?.isAxiosError),
  },
}));
vi.mock('../src/common/prisma', () => ({ default: mockPrisma }));
vi.mock('../src/modules/appointments/appointments.service', () => ({
  updateAppointmentStatus: mockUpdateStatus,
}));
vi.mock('../src/worker/queues', () => ({
  removeNotificationDelivery: mockRemoveDelivery,
}));

import { envSchema } from '../src/common/config/env';
import { ConsoleSmsProvider, TwilioSmsProvider } from '../src/worker/sms.provider';
import {
  computeTwilioSignature,
  handleInboundSmsReply,
  parseReplyIntent,
  verifyTwilioSignature,
} from '../src/modules/notifications/notifications.webhook';

beforeEach(() => {
  vi.resetAllMocks();
});

describe('SMS providers and configuration', () => {
  it('fails fast when SMS_PROVIDER=twilio is missing credentials or sender identity', () => {
    const base = {
      DATABASE_URL: 'mysql://u:p@localhost:3306/fastrev',
      JWT_SECRET: '0123456789abcdef0123456789abcdef',
      AI_SERVICE_URL: 'http://localhost:8000',
      REDIS_URL: 'redis://localhost:6379',
    };

    expect(envSchema.safeParse({ ...base, SMS_PROVIDER: 'console' }).success).toBe(true);
    expect(envSchema.safeParse({ ...base, SMS_PROVIDER: 'twilio' }).success).toBe(false);
    expect(envSchema.safeParse({
      ...base,
      SMS_PROVIDER: 'twilio',
      TWILIO_ACCOUNT_SID: 'AC123',
      TWILIO_AUTH_TOKEN: 'secret',
      TWILIO_FROM_NUMBER: '+15550100',
    }).success).toBe(true);
  });

  it('logs and returns a synthetic id in ConsoleSmsProvider', async () => {
    const provider = new ConsoleSmsProvider();
    const res = await provider.send({ to: '+15550101', body: 'Hello' });
    expect(res.providerMessageId).toMatch(/^console-/);
  });

  it('posts URL-encoded credentials to Twilio and returns the message SID', async () => {
    mockPost.mockResolvedValue({ data: { sid: 'SM987654321' } });
    const provider = new TwilioSmsProvider({
      accountSid: 'AC_TEST',
      authToken: 'auth_secret',
      fromNumber: '+15550100',
    });

    const delivery = await provider.send({ to: '+15550199', body: 'Appointment tomorrow' });

    expect(delivery.providerMessageId).toBe('SM987654321');
    expect(mockPost).toHaveBeenCalledWith(
      'https://api.twilio.com/2010-04-01/Accounts/AC_TEST/Messages.json',
      expect.stringContaining('From=%2B15550100'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Basic ${Buffer.from('AC_TEST:auth_secret').toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        }),
      }),
    );
  });

  it('surfaces a clean error without credentials when Twilio rejects a send', async () => {
    mockPost.mockRejectedValue({
      isAxiosError: true,
      response: { status: 400, data: { code: 21211 } },
    });
    const provider = new TwilioSmsProvider({
      accountSid: 'AC_TEST',
      authToken: 'super_secret_token',
      messagingServiceSid: 'MG_TEST',
    });

    await expect(provider.send({ to: 'invalid', body: 'Hi' })).rejects.toThrow(
      'Twilio SMS delivery failed (HTTP 400, code 21211)',
    );
  });
});

describe('inbound SMS reminder replies', () => {
  it('parses confirmation and cancellation keywords', () => {
    expect(parseReplyIntent('1')).toBe('confirm');
    expect(parseReplyIntent(' yes please ')).toBe('confirm');
    expect(parseReplyIntent('2')).toBe('cancel');
    expect(parseReplyIntent('CANCEL')).toBe('cancel');
    expect(parseReplyIntent('what time?')).toBe('unknown');
  });

  it('verifies HMAC-SHA1 Twilio webhook signatures accurately', () => {
    const url = 'https://fastrev-api.onrender.com/api/v1/notifications/webhooks/sms';
    const params = { Body: '1', From: '+15550101' };
    const sig = computeTwilioSignature('webhook_secret', url, params);

    expect(verifyTwilioSignature('webhook_secret', sig, url, params)).toBe(true);
    expect(verifyTwilioSignature('wrong_secret', sig, url, params)).toBe(false);
    expect(verifyTwilioSignature('webhook_secret', undefined, url, params)).toBe(false);
  });

  it('confirms a booked upcoming appointment when the patient replies 1', async () => {
    mockPrisma.patient.findMany.mockResolvedValue([{ id: 'p1', phone: '+1 (555) 010-1234', name: 'Amina' }]);
    mockPrisma.appointment.findFirst.mockResolvedValue({
      id: 'appt-1',
      status: 'booked',
      scheduledAt: new Date('2030-05-01T10:00:00Z'),
    });

    const res = await handleInboundSmsReply('+15550101234', '1');

    expect(res.action).toBe('confirmed');
    expect(mockUpdateStatus).toHaveBeenCalledWith('appt-1', 'confirmed');
  });

  it('cancels an upcoming appointment and removes queued BullMQ jobs when the patient replies 2', async () => {
    mockPrisma.patient.findMany.mockResolvedValue([{ id: 'p1', phone: '+15550101234', name: 'Amina' }]);
    mockPrisma.appointment.findFirst.mockResolvedValue({
      id: 'appt-2',
      status: 'confirmed',
      scheduledAt: new Date('2030-05-01T10:00:00Z'),
    });
    mockPrisma.notification.findMany.mockResolvedValue([{ id: 'n-48h' }, { id: 'n-4h' }]);

    const res = await handleInboundSmsReply('+15550101234', '2');

    expect(res.action).toBe('cancelled');
    expect(mockUpdateStatus).toHaveBeenCalledWith('appt-2', 'cancelled');
    expect(mockRemoveDelivery).toHaveBeenCalledTimes(2);
  });
});

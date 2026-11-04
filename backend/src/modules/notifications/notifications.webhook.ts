import { createHmac, timingSafeEqual } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../../common/config/env';
import { logger } from '../../common/logger';
import { AppError } from '../../common/middleware/errorHandler';
import prisma from '../../common/prisma';
import { removeNotificationDelivery } from '../../worker/queues';
import { updateAppointmentStatus } from '../appointments/appointments.service';

const inboundSmsSchema = z.object({
  From: z.string().min(3),
  Body: z.string().default(''),
});

export function computeTwilioSignature(authToken: string, url: string, params: Record<string, unknown>): string {
  const sortedKeys = Object.keys(params).sort();
  let payload = url;
  for (const key of sortedKeys) {
    const val = params[key];
    if (val !== undefined && val !== null) {
      payload += key + String(val);
    }
  }
  return createHmac('sha1', authToken).update(payload, 'utf8').digest('base64');
}

export function verifyTwilioSignature(authToken: string, signature: string | undefined, url: string, params: Record<string, unknown>): boolean {
  if (!signature) return false;
  const expected = Buffer.from(computeTwilioSignature(authToken, url, params), 'utf8');
  const received = Buffer.from(signature, 'utf8');
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}

function normalizeDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function parseReplyIntent(body: string): 'confirm' | 'cancel' | 'unknown' {
  const token = body.trim().split(/\s+/)[0]?.toUpperCase() ?? '';
  if (['1', 'YES', 'Y', 'CONFIRM', 'CONFIRMED'].includes(token)) return 'confirm';
  if (['2', 'NO', 'N', 'CANCEL', 'CANCELLED'].includes(token)) return 'cancel';
  return 'unknown';
}

export async function handleInboundSmsReply(from: string, body: string) {
  const intent = parseReplyIntent(body);
  if (intent === 'unknown') {
    return {
      action: 'ignored' as const,
      reply: 'FastRev: Reply 1 to confirm your upcoming appointment or 2 to cancel.',
    };
  }

  const digits = normalizeDigits(from);
  const tail = digits.slice(-10);
  const candidates = await prisma.patient.findMany({
    where: tail ? { phone: { contains: tail.slice(-7) } } : { phone: from },
    select: { id: true, phone: true, name: true },
  });
  const patient = candidates.find((p) => {
    const pDigits = normalizeDigits(p.phone);
    return p.phone === from || (digits.length >= 7 && (pDigits === digits || pDigits.endsWith(tail) || digits.endsWith(pDigits)));
  });

  if (!patient) {
    logger.info({ phoneLast4: from.slice(-4) }, 'Inbound SMS reply from unrecognized phone');
    return {
      action: 'unmatched' as const,
      reply: 'FastRev: No upcoming appointment found for this phone number.',
    };
  }

  const upcoming = await prisma.appointment.findFirst({
    where: {
      patientId: patient.id,
      status: { in: ['booked', 'confirmed'] },
      scheduledAt: { gt: new Date() },
    },
    orderBy: { scheduledAt: 'asc' },
    select: { id: true, status: true, scheduledAt: true },
  });

  if (!upcoming) {
    return {
      action: 'no_upcoming' as const,
      reply: 'FastRev: You have no upcoming open appointments.',
    };
  }

  if (intent === 'confirm') {
    if (upcoming.status === 'booked') {
      await updateAppointmentStatus(upcoming.id, 'confirmed');
    }
    return {
      action: 'confirmed' as const,
      appointmentId: upcoming.id,
      reply: `FastRev: Your appointment at ${upcoming.scheduledAt.toISOString()} is confirmed.`,
    };
  }

  const cancelled = await prisma.notification.findMany({
    where: { appointmentId: upcoming.id, status: { in: ['queued', 'retrying'] } },
    select: { id: true },
  });
  await updateAppointmentStatus(upcoming.id, 'cancelled');
  await Promise.all(cancelled.map(({ id }) => removeNotificationDelivery(id)));

  return {
    action: 'cancelled' as const,
    appointmentId: upcoming.id,
    reply: `FastRev: Your appointment at ${upcoming.scheduledAt.toISOString()} has been cancelled.`,
  };
}

export async function inboundSmsWebhookController(req: Request, res: Response, next: NextFunction) {
  try {
    if (env.SMS_PROVIDER === 'console' && env.NODE_ENV === 'production') {
      throw new AppError(403, 'Inbound SMS webhook requires an active SMS provider');
    }
    if (env.SMS_PROVIDER === 'twilio') {
      const webhookUrl = env.TWILIO_WEBHOOK_URL ?? `${req.protocol}://${req.get('host')}${req.originalUrl}`;
      const valid = verifyTwilioSignature(
        env.TWILIO_AUTH_TOKEN!,
        req.header('x-twilio-signature'),
        webhookUrl,
        (req.body ?? {}) as Record<string, unknown>,
      );
      if (!valid) {
        throw new AppError(403, 'Invalid webhook signature');
      }
    }

    const parsed = inboundSmsSchema.parse(req.body);
    const result = await handleInboundSmsReply(parsed.From, parsed.Body);
    res.json({
      success: true,
      data: result,
      message: result.reply,
    });
  } catch (err) {
    next(err);
  }
}

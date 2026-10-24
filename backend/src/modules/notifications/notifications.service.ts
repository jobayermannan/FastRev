import prisma from '../../common/prisma';
import { logger } from '../../common/logger';
import { enqueueNotificationDelivery, removeNotificationDelivery } from '../../worker/queues';
import { getSmsProvider } from '../../worker/sms.provider';

type ReminderPlan = { hoursBefore: number; type: 'standard_reminder' | 'high_risk_reminder' };

const FAR_AHEAD_DAYS = 14;

function reminderPlans(riskLevel: string | undefined, leadTimeDays: number): ReminderPlan[] {
  if (riskLevel === 'high') {
    return [
      { hoursBefore: 48, type: 'high_risk_reminder' },
      { hoursBefore: 4, type: 'high_risk_reminder' },
    ];
  }
  // A new patient has no history, but booking far ahead is itself a strong no-show signal.
  if (riskLevel === 'new_patient' && leadTimeDays >= FAR_AHEAD_DAYS) {
    return [
      { hoursBefore: 48, type: 'standard_reminder' },
      { hoursBefore: 24, type: 'standard_reminder' },
    ];
  }
  return [{ hoursBefore: 24, type: 'standard_reminder' }];
}

export async function scheduleAppointmentReminders(appointmentId: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { prediction: true, patient: { select: { phone: true } } },
  });
  if (!appointment || !['booked', 'confirmed'].includes(appointment.status)) return [];

  const now = Date.now();
  const notifications = [];
  const leadTimeDays = (appointment.scheduledAt.getTime() - appointment.createdAt.getTime()) / 86_400_000;
  const plans = reminderPlans(appointment.prediction?.riskLevel, leadTimeDays);
  const keyFor = (plan: ReminderPlan) => `${appointment.id}:sms:${plan.hoursBefore}h`;

  // A re-score can change the plan, so reminders that belong only to the old plan must not still go out.
  const stale = await prisma.notification.findMany({
    where: { appointmentId, status: { in: ['queued', 'retrying'] }, dedupeKey: { notIn: plans.map(keyFor) } },
    select: { id: true },
  });
  if (stale.length) {
    await prisma.notification.updateMany({
      where: { id: { in: stale.map(({ id }) => id) }, status: { in: ['queued', 'retrying'] } },
      data: { status: 'cancelled' },
    });
    await Promise.all(stale.map(({ id }) => removeNotificationDelivery(id)));
  }

  for (const plan of plans) {
    const scheduledAt = new Date(appointment.scheduledAt.getTime() - plan.hoursBefore * 3_600_000);
    const dedupeKey = keyFor(plan);
    let notification = await prisma.notification.upsert({
      where: { dedupeKey },
      create: {
        appointmentId: appointment.id,
        dedupeKey,
        channel: 'sms',
        type: plan.type,
        status: 'queued',
        scheduledAt,
      },
      update: {},
    });
    if (notification.status === 'cancelled') {
      // Back in the plan after an earlier re-score dropped it; clear its old job so the id can be reused.
      notification = await prisma.notification.update({
        where: { id: notification.id }, data: { status: 'queued', type: plan.type, scheduledAt },
      });
      await removeNotificationDelivery(notification.id);
    }
    notifications.push(notification);
    if (notification.status === 'queued') {
      await enqueueNotificationDelivery(notification.id, scheduledAt.getTime() - now);
    }
  }
  return notifications;
}

export async function cancelAppointmentReminders(appointmentId: string) {
  await prisma.notification.updateMany({
    where: { appointmentId, status: { in: ['queued', 'retrying'] } },
    data: { status: 'cancelled' },
  });
}

export async function deliverNotification(notificationId: string) {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
    include: { appointment: { include: { patient: { select: { phone: true, name: true } } } } },
  });
  if (!notification || notification.status === 'sent' || notification.status === 'cancelled') return;

  if (['cancelled', 'completed', 'no_show'].includes(notification.appointment.status)) {
    await prisma.notification.update({ where: { id: notification.id }, data: { status: 'cancelled' } });
    return;
  }

  await prisma.notification.update({
    where: { id: notification.id },
    data: { status: 'retrying', attempts: { increment: 1 }, errorMessage: null },
  });
  try {
    const delivery = await getSmsProvider().send({
      to: notification.appointment.patient.phone,
      body: `FastRev reminder: ${notification.appointment.patient.name}, you have an appointment at ${notification.appointment.scheduledAt.toISOString()}.`,
    });
    await prisma.notification.update({
      where: { id: notification.id },
      data: { status: 'sent', sentAt: new Date(), providerMessageId: delivery.providerMessageId },
    });
  } catch (error) {
    logger.warn({ notificationId, errorName: error instanceof Error ? error.name : 'Unknown' }, 'SMS delivery attempt failed');
    throw error;
  }
}

export async function markNotificationFailed(notificationId: string, error: unknown) {
  await prisma.notification.update({
    where: { id: notificationId },
    data: {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message.slice(0, 191) : 'Unknown delivery error',
    },
  });
}

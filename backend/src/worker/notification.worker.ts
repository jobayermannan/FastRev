import { Worker } from 'bullmq';
import { logger } from '../common/logger';
import { scoreAppointment } from '../modules/predictions/predictions.service';
import {
  deliverNotification,
  markNotificationFailed,
  scheduleAppointmentReminders,
} from '../modules/notifications/notifications.service';
import {
  closeQueues,
  createWorkerConnection,
  NOTIFICATION_QUEUE,
  PREDICTION_RETRY_QUEUE,
} from './queues';

const predictionWorker = new Worker(
  PREDICTION_RETRY_QUEUE,
  async (job) => {
    const { appointmentId } = job.data as { appointmentId: string };
    const { needsRetry } = await scoreAppointment(appointmentId);
    if (needsRetry) {
      throw new Error('Prediction service remains unavailable');
    }
    await scheduleAppointmentReminders(appointmentId);
  },
  { connection: createWorkerConnection(), concurrency: 2 },
);

const notificationWorker = new Worker(
  NOTIFICATION_QUEUE,
  async (job) => {
    const { notificationId } = job.data as { notificationId: string };
    await deliverNotification(notificationId);
  },
  { connection: createWorkerConnection(), concurrency: 4 },
);

notificationWorker.on('failed', async (job, error) => {
  if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
    await markNotificationFailed((job.data as { notificationId: string }).notificationId, error);
  }
});

for (const worker of [predictionWorker, notificationWorker]) {
  worker.on('error', (error) => logger.error({ errorName: error.name }, 'Background worker error'));
}

logger.info('Notification and prediction retry workers started');

async function shutdown(signal: string) {
  logger.info(`${signal} received, stopping background workers`);
  await Promise.all([predictionWorker.close(), notificationWorker.close(), closeQueues()]);
  process.exit(0);
}

process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
process.on('SIGINT', () => { void shutdown('SIGINT'); });

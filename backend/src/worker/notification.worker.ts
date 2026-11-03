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

/**
 * Starts the queue consumers and returns the handle that stops them.
 *
 * The workers are their own process wherever the host can run one (Compose, and any Render plan
 * that offers background workers). On a free plan there is no such process, so the API starts
 * them in-process instead — which is why this registers no signal handlers of its own: whoever
 * starts the workers owns the shutdown.
 */
export function startWorkers() {
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

  return async function stopWorkers() {
    await Promise.all([predictionWorker.close(), notificationWorker.close(), closeQueues()]);
  };
}

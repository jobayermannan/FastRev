import { JobsOptions, Queue } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../common/config/env';

export const PREDICTION_RETRY_QUEUE = 'prediction-retry';
export const NOTIFICATION_QUEUE = 'notification-delivery';

let queueConnection: IORedis | undefined;
let predictionRetryQueue: Queue | undefined;
let notificationQueue: Queue | undefined;

function getQueueConnection() {
  if (!queueConnection) {
    queueConnection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: true });
  }
  return queueConnection;
}

export function createWorkerConnection() {
  return new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
}

function getPredictionRetryQueue() {
  predictionRetryQueue ??= new Queue(PREDICTION_RETRY_QUEUE, { connection: getQueueConnection() });
  return predictionRetryQueue;
}

function getNotificationQueue() {
  notificationQueue ??= new Queue(NOTIFICATION_QUEUE, { connection: getQueueConnection() });
  return notificationQueue;
}

const retryOptions: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 60_000 },
  removeOnComplete: 100,
  removeOnFail: 100,
};

export async function enqueuePredictionRetry(appointmentId: string) {
  return getPredictionRetryQueue().add(
    'score-appointment',
    { appointmentId },
    { ...retryOptions, jobId: `prediction-${appointmentId}` },
  );
}

// Re-scores after an attendance outcome need a fresh job id: BullMQ silently skips an add whose id
// is still held by an earlier finished job for the same appointment.
export async function enqueuePredictionRefresh(appointmentId: string) {
  return getPredictionRetryQueue().add(
    'score-appointment',
    { appointmentId },
    { ...retryOptions, jobId: `prediction-refresh-${appointmentId}-${Date.now()}` },
  );
}

export async function enqueueNotificationDelivery(notificationId: string, delay: number) {
  return getNotificationQueue().add(
    'send-reminder',
    { notificationId },
    { ...retryOptions, delay: Math.max(0, delay), jobId: `notification-${notificationId}` },
  );
}

// Removes a reminder's pending job; a job already being processed is left to see the cancelled status.
export async function removeNotificationDelivery(notificationId: string) {
  try {
    await getNotificationQueue().remove(`notification-${notificationId}`);
  } catch {
    // An active job is locked and cannot be removed; delivery re-checks the status before sending.
  }
}

export async function closeQueues() {
  await Promise.all([
    predictionRetryQueue?.close(),
    notificationQueue?.close(),
  ]);
  if (queueConnection) await queueConnection.quit();
}

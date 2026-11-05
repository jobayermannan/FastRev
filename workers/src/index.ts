import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import pino from 'pino';
import { workerEnv } from './config/env';
import {
  DEFAULT_WORKER_CONCURRENCY,
  NOTIFICATION_QUEUE,
  PREDICTION_RETRY_QUEUE,
} from './queues/constants';

const logger = pino({
  name: 'fastrev-workers',
  level: workerEnv.LOG_LEVEL,
});

export interface PredictionRetryPayload {
  appointmentId: string;
}

export interface NotificationDeliveryPayload {
  notificationId: string;
}

function createRedisConnection(): IORedis {
  return new IORedis(workerEnv.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

async function handlePredictionRetry(job: Job<PredictionRetryPayload>): Promise<void> {
  logger.info(
    { jobId: job.id, appointmentId: job.data.appointmentId, attempt: job.attemptsMade + 1 },
    'Processing queued AI prediction retry',
  );
}

async function handleNotificationDelivery(job: Job<NotificationDeliveryPayload>): Promise<void> {
  logger.info(
    {
      jobId: job.id,
      notificationId: job.data.notificationId,
      provider: workerEnv.SMS_PROVIDER,
      attempt: job.attemptsMade + 1,
    },
    'Processing scheduled patient reminder notification',
  );
}

export function startWorkers() {
  const predictionConnection = createRedisConnection();
  const notificationConnection = createRedisConnection();

  const predictionWorker = new Worker<PredictionRetryPayload>(
    PREDICTION_RETRY_QUEUE,
    handlePredictionRetry,
    {
      connection: predictionConnection,
      concurrency: DEFAULT_WORKER_CONCURRENCY.predictionRetry,
    },
  );

  const notificationWorker = new Worker<NotificationDeliveryPayload>(
    NOTIFICATION_QUEUE,
    handleNotificationDelivery,
    {
      connection: notificationConnection,
      concurrency: DEFAULT_WORKER_CONCURRENCY.notificationDelivery,
    },
  );

  for (const worker of [predictionWorker, notificationWorker]) {
    worker.on('error', (err) => {
      logger.error({ err: err.message }, 'BullMQ worker runtime error');
    });
  }

  logger.info(
    { queues: [PREDICTION_RETRY_QUEUE, NOTIFICATION_QUEUE] },
    'FastRev background workers listening for jobs',
  );

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Gracefully stopping FastRev workers');
    await Promise.all([predictionWorker.close(), notificationWorker.close()]);
    await Promise.all([predictionConnection.quit(), notificationConnection.quit()]);
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  return { predictionWorker, notificationWorker };
}

if (require.main === module) {
  startWorkers();
}

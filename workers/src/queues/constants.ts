export const PREDICTION_RETRY_QUEUE = 'prediction-retry';
export const NOTIFICATION_QUEUE = 'notification-delivery';

export const DEFAULT_WORKER_CONCURRENCY = {
  predictionRetry: 2,
  notificationDelivery: 4,
} as const;

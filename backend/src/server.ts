import { createApp } from './app';
import { env } from './common/config/env';
import { logger } from './common/logger';
import prisma from './common/prisma';

const app = createApp();

const RETRY_DELAYS_MS = [2000, 4000, 8000, 16000, 32000];

async function start() {
  try {
    await connectWithRetry(0);

    const server = app.listen(env.PORT, () => {
      logger.info(`Server listening on port ${env.PORT}`);
    });

    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully`);
      server.close(async () => {
        await prisma.$disconnect();
        logger.info('Database disconnected');
        process.exit(0);
      });
      setTimeout(() => {
        logger.error('Forced shutdown due to timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (err) {
    logger.error(err, 'Failed to start server');
    process.exit(1);
  }
}

async function connectWithRetry(attempt: number): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('Database connected');
  } catch (err) {
    const delayMs = RETRY_DELAYS_MS[attempt];
    const nextAttempt = attempt + 1;
    const maxAttempts = RETRY_DELAYS_MS.length;

    if (delayMs !== undefined) {
      logger.warn(
        `Database connection failed (attempt ${nextAttempt}/${maxAttempts}), retrying in ${delayMs / 1000}s: ${err instanceof Error ? err.message : String(err)}`
      );
      await sleep(delayMs);
      await connectWithRetry(nextAttempt);
    } else {
      logger.error(
        `Database connection failed after ${maxAttempts} attempts: ${err instanceof Error ? err.message : String(err)}`
      );
      throw err;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

start();

import { createApp } from './app';
import { env } from './common/config/env';
import { logger } from './common/logger';
import prisma from './common/prisma';
import { startWorkers } from './worker/notification.worker';

const app = createApp();

const RETRY_DELAYS_MS = [2000, 4000, 8000, 16000, 32000, 60000];

let shuttingDown = false;

async function warmDatabase(): Promise<void> {
  let attempt = 0;
  while (!shuttingDown) {
    try {
      await prisma.$connect();
      logger.info('Database connected');
      return;
    } catch (err) {
      const delayMs = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
      attempt += 1;
      logger.warn(
        `Database connection attempt ${attempt} failed, retrying in ${delayMs / 1000}s: ${err instanceof Error ? err.message : String(err)}`,
      );
      await sleep(delayMs);
    }
  }
}

function start() {
  // Bind the HTTP port immediately so managed hosts see /health pass and callers receive a
  // structured 503 ("The database is waking up") instead of a hung proxy socket while a
  // free-tier database wakes from idle.
  const server = app.listen(env.PORT, () => {
    logger.info(`Server listening on port ${env.PORT}`);
  });

  void warmDatabase();

  const stopWorkers = env.RUN_WORKERS_IN_PROCESS ? startWorkers() : null;

  const gracefulShutdown = (signal: string) => {
    shuttingDown = true;
    logger.info(`${signal} received, shutting down gracefully`);
    server.close(async () => {
      await stopWorkers?.();
      await prisma.$disconnect();
      logger.info('Database disconnected');
      process.exit(0);
    });
    setTimeout(() => {
      logger.error('Forced shutdown due to timeout');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

start();

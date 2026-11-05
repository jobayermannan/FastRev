import { logger } from '../common/logger';
import { startWorkers } from './notification.worker';

/** The standalone worker process: nothing here but the queues and their shutdown. */
const stopWorkers = startWorkers();

async function shutdown(signal: string) {
  logger.info(`${signal} received, stopping background workers`);
  await stopWorkers();
  process.exit(0);
}

process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
process.on('SIGINT', () => { void shutdown('SIGINT'); });

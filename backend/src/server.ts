import { app } from './app.js';
import { env } from './config/env.js';
import { closeDatabasePool } from './database/postgres.js';
import { logger } from './utils/logger.js';

const server = app.listen(env.port, () => {
  logger.info({ port: env.port }, 'THPT-PCT-PT API is running');
});

let isShuttingDown = false;

async function shutdown(signal: NodeJS.Signals) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info({ signal }, 'Graceful shutdown started');

  const forceShutdownTimer = setTimeout(() => {
    logger.error({ signal }, 'Graceful shutdown timed out');
    process.exit(1);
  }, 10_000);
  forceShutdownTimer.unref();

  server.close(async (error) => {
    try {
      await closeDatabasePool();
    } catch (databaseError) {
      logger.error(
        { error: databaseError },
        'Failed to close the database pool during shutdown',
      );
      process.exitCode = 1;
    }

    if (error) {
      logger.error({ error }, 'HTTP server shutdown failed');
      process.exitCode = 1;
    }

    clearTimeout(forceShutdownTimer);
    logger.info({ signal }, 'Graceful shutdown completed');
  });
}

server.on('error', (error) => {
  logger.error({ error, port: env.port }, 'HTTP server failed');
  process.exitCode = 1;
});

process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});

process.once('SIGINT', () => {
  void shutdown('SIGINT');
});

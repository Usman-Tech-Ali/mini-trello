import { createServer } from 'node:http';

import { createApp } from './app';
import { config } from './config/env';
import {
  assertTransactionsSupported,
  connectDatabase,
  disconnectDatabase,
  initModels,
} from './db/connection';
import { logger } from './lib/logger';
import { createRealtimeServer } from './realtime/realtime-server';

const SHUTDOWN_TIMEOUT_MS = 10_000;

async function main(): Promise<void> {
  await connectDatabase(config.mongodbUri);
  await assertTransactionsSupported();
  await initModels();
  logger.info('Connected to MongoDB');

  const server = createServer(createApp());
  const realtime = createRealtimeServer(server);
  // Promise-based so startup failures (e.g. port already in use) go through the fatal-log path below.
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.port, () => {
      server.off('error', reject);
      resolve();
    });
  });
  logger.info(`API listening on http://localhost:${config.port} (${config.nodeEnv})`);

  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down');

    setTimeout(() => {
      logger.error('Graceful shutdown timed out; forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS).unref();

    // Closes all sockets, then the HTTP server.
    void realtime.close(() => {
      disconnectDatabase()
        .then(() => process.exit(0))
        .catch((error: unknown) => {
          logger.error({ err: error }, 'Error while disconnecting from MongoDB');
          process.exit(1);
        });
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error: unknown) => {
  logger.fatal({ err: error }, 'Failed to start API');
  process.exit(1);
});

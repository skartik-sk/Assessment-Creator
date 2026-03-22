import { startWorker, stopWorker } from './src/queue/worker';

if (!process.env.REDIS_URL) {
  console.log('Worker idle: REDIS_URL is not configured, demo mode is active.');
} else {
  startWorker();
}

const shutdown = () => {
  if (process.env.REDIS_URL) {
    stopWorker();
  }
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

setInterval(() => undefined, 1 << 30);

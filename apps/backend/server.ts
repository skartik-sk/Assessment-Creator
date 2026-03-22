import { createServer } from 'node:http';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { env } from './src/config/env';
import { getDemoJobStatus } from './src/demo-store';
import { apiRouter } from './src/routes';
import { getJobStatus } from './src/queue/setup';
import { clearSocketIOServer, setSocketIOServer } from './src/websocket/server';
import type { JobStatusPayload } from './src/types';

const host = env.HOST;
const port = env.PORT;

interface SubscriptionState {
  refs: number;
  lastPayload: string;
  interval: NodeJS.Timeout;
}

const subscriptions = new Map<string, SubscriptionState>();

const stopSubscription = (jobId: string) => {
  const active = subscriptions.get(jobId);
  if (!active) {
    return;
  }

  clearInterval(active.interval);
  subscriptions.delete(jobId);
};

const normalizeQueuedJob = async (jobId: string): Promise<JobStatusPayload | null> => {
  if (!env.REDIS_URL) {
    return getDemoJobStatus(jobId);
  }

  const jobStatus = await getJobStatus(jobId);
  if (!jobStatus) {
    return null;
  }

  return {
    jobId: String(jobStatus.id),
    assignmentId: jobStatus.data.assignmentId,
    status:
      jobStatus.state === 'completed'
        ? 'completed'
        : jobStatus.state === 'failed'
        ? 'failed'
        : jobStatus.state === 'active'
        ? 'processing'
        : 'queued',
    currentStep: typeof jobStatus.progress === 'number' ? Math.min(Math.ceil(jobStatus.progress / 20), 5) : 0,
    totalSteps: 5,
    result: jobStatus.result?.result,
    error: jobStatus.failedReason || jobStatus.result?.error,
  };
};

const expressApp = express();
expressApp.disable('x-powered-by');

// Allow both localhost and 127.0.0.1 for CORS
const getAllowedOrigins = () => {
  const origin = env.FRONTEND_ORIGIN;
  // Handle both localhost and 127.0.0.1
  if (origin.includes('127.0.0.1')) {
    const localhostVersion = origin.replace('127.0.0.1', 'localhost');
    return [origin, localhostVersion];
  }
  if (origin.includes('localhost')) {
    const ipVersion = origin.replace('localhost', '127.0.0.1');
    return [origin, ipVersion];
  }
  return [origin];
};

const allowedOrigins = getAllowedOrigins();

expressApp.use((request, response, next) => {
  const origin = request.headers.origin;
  // Check if the origin is allowed
  if (origin && allowedOrigins.includes(origin)) {
    response.header('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    // For same-origin requests or requests without Origin header
    response.header('Access-Control-Allow-Origin', env.FRONTEND_ORIGIN);
  }
  response.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  response.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.header('Access-Control-Allow-Credentials', 'true');

  if (request.method === 'OPTIONS') {
    response.sendStatus(204);
    return;
  }

  next();
});
expressApp.use(express.json({ limit: '5mb' }));
expressApp.use(express.urlencoded({ extended: true }));
expressApp.get('/health', (_request, response) => {
  response.json({
    ok: true,
    app: 'vedaai-backend',
    mongoConfigured: Boolean(env.MONGODB_URI),
    redisConfigured: Boolean(env.REDIS_URL),
    websocketPath: '/api/websocket',
    frontendOrigin: env.FRONTEND_ORIGIN,
    allowedOrigins,
  });
});
expressApp.use('/api', apiRouter);

const httpServer = createServer(expressApp);

const io = new SocketIOServer(httpServer, {
  path: '/api/websocket',
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

setSocketIOServer(io);

const broadcastJob = async (jobId: string) => {
  const active = subscriptions.get(jobId);
  if (!active) {
    return;
  }

  try {
    const payload = await normalizeQueuedJob(jobId);
    if (!payload) {
      return;
    }

    const snapshot = JSON.stringify(payload);
    if (snapshot === active.lastPayload) {
      return;
    }

    active.lastPayload = snapshot;
    io.to(`job:${jobId}`).emit('job:updated', payload);

    if (payload.status === 'completed') {
      io.to(`job:${jobId}`).emit('job:completed', {
        jobId,
        result: payload.result,
      });
      stopSubscription(jobId);
    }

    if (payload.status === 'failed') {
      io.to(`job:${jobId}`).emit('job:failed', {
        jobId,
        error: payload.error || 'Job failed.',
      });
      stopSubscription(jobId);
    }
  } catch {
    // Keep the socket server alive even if a status read fails temporarily.
  }
};

const retainSubscription = (jobId: string) => {
  const current = subscriptions.get(jobId);

  if (current) {
    current.refs += 1;
    void broadcastJob(jobId);
    return;
  }

  const interval = setInterval(() => {
    void broadcastJob(jobId);
  }, 1000);

  subscriptions.set(jobId, {
    refs: 1,
    lastPayload: '',
    interval,
  });

  void broadcastJob(jobId);
};

const releaseSubscription = (jobId: string) => {
  const current = subscriptions.get(jobId);
  if (!current) {
    return;
  }

  current.refs -= 1;
  if (current.refs <= 0) {
    stopSubscription(jobId);
  }
};

io.on('connection', (socket) => {
  const subscribedJobs = new Set<string>();

  socket.on('job:subscribe', (jobId: string) => {
    if (typeof jobId !== 'string' || !jobId.trim()) {
      return;
    }

    const normalizedJobId = jobId.trim();
    socket.join(`job:${normalizedJobId}`);
    subscribedJobs.add(normalizedJobId);
    retainSubscription(normalizedJobId);
  });

  socket.on('job:unsubscribe', (jobId: string) => {
    if (typeof jobId !== 'string' || !jobId.trim()) {
      return;
    }

    const normalizedJobId = jobId.trim();
    socket.leave(`job:${normalizedJobId}`);

    if (subscribedJobs.delete(normalizedJobId)) {
      releaseSubscription(normalizedJobId);
    }
  });

  socket.on('disconnect', () => {
    for (const jobId of subscribedJobs) {
      releaseSubscription(jobId);
    }
  });
});

const shutdown = async () => {
  clearSocketIOServer();

  for (const jobId of subscriptions.keys()) {
    stopSubscription(jobId);
  }

  await new Promise<void>((resolve) => {
    io.close(() => resolve());
  });

  httpServer.close(() => {
    process.exit(0);
  });
};

process.on('SIGINT', () => {
  void shutdown();
});
process.on('SIGTERM', () => {
  void shutdown();
});

httpServer.listen(port, host, () => {
  console.log(`> Backend ready on http://${host}:${port}`);
});

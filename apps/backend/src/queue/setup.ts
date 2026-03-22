import { Job, Queue, QueueEvents, Worker } from 'bullmq';
import { GeneratedPaper, SourceFile } from '../types';

interface RedisConnectionOptions {
  host: string;
  port: number;
  password?: string;
  maxRetriesPerRequest?: null;
}

const redisUrl = process.env.REDIS_URL;

const parseRedisUrl = (url: string): RedisConnectionOptions => {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    password: parsed.password || undefined,
    maxRetriesPerRequest: null,
  };
};

const connection = redisUrl ? parseRedisUrl(redisUrl) : null;

export const generateQueue = connection
  ? new Queue('question-paper-generation', {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          count: 100,
          age: 24 * 3600,
        },
        removeOnFail: {
          count: 5000,
        },
      },
    })
  : null;

export const pdfQueue = connection
  ? new Queue('question-paper-pdf', {
      connection,
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          count: 100,
          age: 24 * 3600,
        },
        removeOnFail: {
          count: 5000,
        },
      },
    })
  : null;

export interface GenerateJobData {
  assignmentId: string;
  school?: string;
  subject?: string;
  classLevel?: string;
  timeAllowed?: string;
  maxMarks?: number;
  questionTypes: Array<{
    type: string;
    count: number;
    marks: number;
  }>;
  additionalInfo?: string;
  userId?: string;
  sourceFile?: SourceFile | null;
}

export interface GenerateJobResult {
  success: boolean;
  paperId?: string;
  error?: string;
  result?: GeneratedPaper;
}

export interface GeneratePdfJobData {
  paper: GeneratedPaper;
}

export interface GeneratePdfJobResult {
  success: boolean;
  fileName?: string;
  pdfBase64?: string;
  error?: string;
}

export function setupGenerateWorker(processor: (job: Job<GenerateJobData>) => Promise<GenerateJobResult>) {
  if (!connection) {
    throw new Error('Redis is not configured.');
  }

  const worker = new Worker<GenerateJobData, GenerateJobResult>('question-paper-generation', processor, {
    connection,
    concurrency: 3,
  });

  worker.on('completed', (job, result) => {
    console.log(`Job ${job.id} completed with result:`, result);
  });

  worker.on('failed', (job, error) => {
    console.error(`Job ${job?.id} failed:`, error.message);
  });

  return worker;
}

export function setupPdfWorker(processor: (job: Job<GeneratePdfJobData>) => Promise<GeneratePdfJobResult>) {
  if (!connection) {
    throw new Error('Redis is not configured.');
  }

  const worker = new Worker<GeneratePdfJobData, GeneratePdfJobResult>('question-paper-pdf', processor, {
    connection,
    concurrency: 2,
  });

  worker.on('completed', (job, result) => {
    console.log(`PDF job ${job.id} completed with result:`, result?.fileName);
  });

  worker.on('failed', (job, error) => {
    console.error(`PDF job ${job?.id} failed:`, error.message);
  });

  return worker;
}

export async function addGenerateJob(data: GenerateJobData) {
  if (!generateQueue) {
    throw new Error('Redis is not configured.');
  }

  return generateQueue.add('generate', data, {
    jobId: `generate-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  });
}

export async function addPdfJob(data: GeneratePdfJobData) {
  if (!pdfQueue) {
    throw new Error('Redis is not configured.');
  }

  return pdfQueue.add('pdf', data, {
    jobId: `pdf-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  });
}

export async function getJobStatus(jobId: string) {
  if (!generateQueue) {
    return null;
  }

  const job = await generateQueue.getJob(jobId);
  if (!job) {
    return null;
  }

  return {
    id: job.id,
    data: job.data,
    state: await job.getState(),
    progress: job.progress,
    result: job.returnvalue,
    failedReason: job.failedReason,
  };
}

export async function waitForPdfJob(jobId: string, timeout = 30000) {
  if (!pdfQueue || !connection) {
    return null;
  }

  const queueEvents = new QueueEvents('question-paper-pdf', { connection });
  await queueEvents.waitUntilReady();

  try {
    const job = await pdfQueue.getJob(jobId);
    if (!job) {
      return null;
    }

    return (await job.waitUntilFinished(queueEvents, timeout)) as GeneratePdfJobResult;
  } finally {
    await queueEvents.close();
  }
}

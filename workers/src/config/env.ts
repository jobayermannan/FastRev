import 'dotenv/config';
import { z } from 'zod';

const workerEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  DATABASE_URL: z.string().url().optional(),
  AI_SERVICE_URL: z.string().url().default('http://localhost:8000'),
  AI_PREDICT_TIMEOUT_MS: z.coerce.number().default(3000),
  SMS_PROVIDER: z.enum(['console']).default('console'),
  LOG_LEVEL: z.string().default('info'),
});

export const workerEnv = workerEnvSchema.parse(process.env);

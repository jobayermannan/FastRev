import 'dotenv/config';
import { z } from 'zod';

const workerEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  DATABASE_URL: z.string().url().optional(),
  AI_SERVICE_URL: z.string().url().default('http://localhost:8000'),
  AI_PREDICT_TIMEOUT_MS: z.coerce.number().default(3000),
  SMS_PROVIDER: z.enum(['console', 'twilio']).default('console'),
  TWILIO_ACCOUNT_SID: z.string().min(1).optional(),
  TWILIO_AUTH_TOKEN: z.string().min(1).optional(),
  TWILIO_FROM_NUMBER: z.string().min(1).optional(),
  TWILIO_MESSAGING_SERVICE_SID: z.string().min(1).optional(),
  LOG_LEVEL: z.string().default('info'),
});

export const workerEnv = workerEnvSchema.parse(process.env);

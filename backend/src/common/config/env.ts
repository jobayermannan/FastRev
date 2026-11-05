import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRY: z.string().default('24h'),
  // Comma-separated browser origins allowed to call the API; unset reflects any origin (development default).
  CORS_ORIGIN: z.string().optional(),
  AI_SERVICE_URL: z.string().url(),
  AI_PREDICT_TIMEOUT_MS: z.coerce.number().default(3000),
  REDIS_URL: z.string().url(),
  SMS_PROVIDER: z.enum(['console', 'twilio']).default('console'),
  TWILIO_ACCOUNT_SID: z.string().min(1).optional(),
  TWILIO_AUTH_TOKEN: z.string().min(1).optional(),
  TWILIO_FROM_NUMBER: z.string().min(1).optional(),
  TWILIO_MESSAGING_SERVICE_SID: z.string().min(1).optional(),
  TWILIO_WEBHOOK_URL: z.string().url().optional(),
  // Hosts without a background-worker process (a free plan) run the queues inside the API.
  // z.coerce.boolean() would read the string "false" as true, so the value is spelled out.
  RUN_WORKERS_IN_PROCESS: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  LOG_LEVEL: z.string().default('info'),
}).superRefine((val, ctx) => {
  if (val.SMS_PROVIDER === 'twilio') {
    if (!val.TWILIO_ACCOUNT_SID) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['TWILIO_ACCOUNT_SID'], message: 'Required when SMS_PROVIDER=twilio' });
    }
    if (!val.TWILIO_AUTH_TOKEN) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['TWILIO_AUTH_TOKEN'], message: 'Required when SMS_PROVIDER=twilio' });
    }
    if (!val.TWILIO_FROM_NUMBER && !val.TWILIO_MESSAGING_SERVICE_SID) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['TWILIO_FROM_NUMBER'],
        message: 'Set TWILIO_FROM_NUMBER or TWILIO_MESSAGING_SERVICE_SID when SMS_PROVIDER=twilio',
      });
    }
  }
});

export const env = envSchema.parse(process.env);

import { z } from 'zod';

export const idempotencyKeySchema = z.string().trim().min(1).max(191).optional();

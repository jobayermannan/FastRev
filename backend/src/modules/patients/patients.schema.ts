import { z } from 'zod';
import { paginationSchema } from '../../common/utils/pagination';

export const createPatientSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(7),
  dateOfBirth: z.coerce.date(),
  userId: z.string().uuid().optional(),
});

export const updatePatientSchema = createPatientSchema.partial().omit({ userId: true });

export const patientQuerySchema = paginationSchema.extend({
  search: z.string().optional(),
  sortBy: z.enum(['name', 'createdAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
export type PatientQuery = z.infer<typeof patientQuerySchema>;

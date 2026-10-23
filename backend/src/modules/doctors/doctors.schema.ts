import { z } from 'zod';
import { paginationSchema } from '../../common/utils/pagination';

export const createDoctorSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  specialty: z.string().trim().min(1).max(191),
});

export const updateDoctorSchema = z.object({
  specialty: z.string().trim().min(1).max(191),
});

export const doctorQuerySchema = paginationSchema;

export type CreateDoctorInput = z.infer<typeof createDoctorSchema>;
export type UpdateDoctorInput = z.infer<typeof updateDoctorSchema>;

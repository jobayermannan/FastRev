import { z } from 'zod';
import { paginationSchema } from '../../common/utils/pagination';

const dateTime = z.string().datetime({ offset: true });
export const appointmentStatusSchema = z.enum(['booked', 'confirmed', 'completed', 'no_show', 'cancelled']);

export const createAppointmentSchema = z.object({
  patientId: z.string().uuid(),
  doctorId: z.string().uuid(),
  scheduledAt: dateTime,
  durationMinutes: z.number().int().positive(),
});

export const appointmentQuerySchema = paginationSchema.extend({
  status: appointmentStatusSchema.optional(),
  riskLevel: z.enum(['low', 'high', 'unknown', 'new_patient']).optional(),
  from: dateTime.optional(),
  to: dateTime.optional(),
  needsOutcome: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
});

export const updateAppointmentStatusSchema = z.object({ status: appointmentStatusSchema });
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type AppointmentQuery = z.infer<typeof appointmentQuerySchema>;
export type AppointmentStatus = z.infer<typeof appointmentStatusSchema>;

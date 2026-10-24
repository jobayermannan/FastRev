import { Request, Response, NextFunction } from 'express';
import { createAppointment, getAppointments, getAppointmentById, updateAppointmentStatus, retryAppointmentPrediction } from './appointments.service';
import {
  createAppointmentSchema, appointmentQuerySchema, updateAppointmentStatusSchema,
} from './appointments.schema';
import { idempotencyKeySchema } from '../../common/utils/idempotency';

export async function createAppointmentController(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createAppointmentSchema.parse(req.body);
    const key = idempotencyKeySchema.parse(req.headers['idempotency-key']);
    const result = await createAppointment(input, key);
    res.status(result.created ? 201 : 200).json({
      success: true, data: result.appointment,
      message: result.created ? 'Appointment created successfully' : 'Appointment already created',
    });
  } catch (err) { next(err); }
}

export async function getAppointmentsController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getAppointments(appointmentQuerySchema.parse(req.query));
    res.json({ success: true, ...result, message: 'Appointments retrieved successfully' });
  } catch (err) { next(err); }
}

export async function getAppointmentByIdController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getAppointmentById(req.params.id);
    res.json({ success: true, data, message: 'Appointment retrieved successfully' });
  } catch (err) { next(err); }
}

export async function updateAppointmentStatusController(req: Request, res: Response, next: NextFunction) {
  try {
    const { status } = updateAppointmentStatusSchema.parse(req.body);
    const data = await updateAppointmentStatus(req.params.id, status);
    res.json({ success: true, data, message: 'Appointment status updated successfully' });
  } catch (err) { next(err); }
}

export async function retryAppointmentPredictionController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await retryAppointmentPrediction(req.params.id);
    res.json({ success: true, data, message: 'Prediction refreshed' });
  } catch (err) { next(err); }
}

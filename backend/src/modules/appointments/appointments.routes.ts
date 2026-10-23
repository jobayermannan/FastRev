import { Router } from 'express';
import { verifyToken, requireRole } from '../auth/auth.middleware';
import {
  createAppointmentController, getAppointmentsController, getAppointmentByIdController,
  updateAppointmentStatusController,
  retryAppointmentPredictionController,
} from './appointments.controller';

const router = Router();

router.use(verifyToken, requireRole('admin'));
router.post('/', createAppointmentController);
router.get('/', getAppointmentsController);
router.get('/:id', getAppointmentByIdController);
router.patch('/:id/status', updateAppointmentStatusController);
router.post('/:id/prediction/retry', retryAppointmentPredictionController);

export default router;

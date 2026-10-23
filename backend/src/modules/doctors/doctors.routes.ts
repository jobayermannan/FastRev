import { Router } from 'express';
import { verifyToken, requireRole } from '../auth/auth.middleware';
import {
  createDoctorController, getDoctorsController, getDoctorByIdController,
  updateDoctorController, deleteDoctorController,
} from './doctors.controller';

const router = Router();

router.use(verifyToken, requireRole('admin'));
router.post('/', createDoctorController);
router.get('/', getDoctorsController);
router.get('/:id', getDoctorByIdController);
router.patch('/:id', updateDoctorController);
router.delete('/:id', deleteDoctorController);

export default router;

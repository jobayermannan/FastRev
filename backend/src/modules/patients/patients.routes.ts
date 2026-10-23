import { Router } from 'express';
import {
  createPatientController,
  getPatientsController,
  getPatientByIdController,
  getPatientRiskProfileController,
  updatePatientController,
  deletePatientController,
} from './patients.controller';
import { verifyToken, requireRole } from '../auth/auth.middleware';

const router = Router();

router.post('/', verifyToken, requireRole('admin'), createPatientController);
router.get('/', verifyToken, requireRole('admin', 'doctor'), getPatientsController);
router.get('/:id/risk-profile', verifyToken, requireRole('admin', 'doctor'), getPatientRiskProfileController);
router.get('/:id', verifyToken, requireRole('admin', 'doctor'), getPatientByIdController);
router.patch('/:id', verifyToken, requireRole('admin'), updatePatientController);
router.delete('/:id', verifyToken, requireRole('admin'), deletePatientController);

export default router;

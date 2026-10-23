import { Request, Response, NextFunction } from 'express';
import {
  enrollPatient,
  getPatients,
  getPatientById,
  getPatientRiskProfile,
  updatePatient,
  deletePatient,
} from './patients.service';
import {
  createPatientSchema,
  updatePatientSchema,
  patientQuerySchema,
  CreatePatientInput,
  UpdatePatientInput,
  PatientQuery,
} from './patients.schema';
import { idempotencyKeySchema } from '../../common/utils/idempotency';
import { AppError } from '../../common/middleware/errorHandler';

export async function createPatientController(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = createPatientSchema.parse(req.body) as CreatePatientInput;
    const adminId = req.user?.userId;
    if (!adminId) {
      throw new AppError(401, 'Unauthorized');
    }
    const result = await enrollPatient(parsed, adminId, idempotencyKeySchema.parse(req.headers['idempotency-key']));
    res.status(result.created ? 201 : 200).json({
      success: true,
      data: result.patient,
      message: result.created ? 'Patient created successfully' : 'Patient already created',
    });
  } catch (err) {
    next(err);
  }
}

export async function getPatientsController(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = patientQuerySchema.parse(req.query) as unknown as PatientQuery;
    const result = await getPatients(parsed);
    res.json({
      success: true,
      ...result,
      message: 'Patients retrieved successfully',
    });
  } catch (err) {
    next(err);
  }
}

export async function getPatientByIdController(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const result = await getPatientById(id);
    res.json({
      success: true,
      data: result,
      message: 'Patient retrieved successfully',
    });
  } catch (err) {
    next(err);
  }
}

export async function getPatientRiskProfileController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getPatientRiskProfile(req.params.id);
    res.json({ success: true, data, message: 'Patient risk profile retrieved successfully' });
  } catch (err) {
    next(err);
  }
}

export async function updatePatientController(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const parsed = updatePatientSchema.parse(req.body) as UpdatePatientInput;
    const result = await updatePatient(id, parsed);
    res.json({
      success: true,
      data: result,
      message: 'Patient updated successfully',
    });
  } catch (err) {
    next(err);
  }
}

export async function deletePatientController(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    await deletePatient(id);
    res.json({
      success: true,
      data: null,
      message: 'Patient deleted successfully',
    });
  } catch (err) {
    next(err);
  }
}

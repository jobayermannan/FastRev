import { Request, Response, NextFunction } from 'express';
import { createDoctor, getDoctors, getDoctorById, updateDoctor, deleteDoctor } from './doctors.service';
import { createDoctorSchema, updateDoctorSchema, doctorQuerySchema } from './doctors.schema';
import { parsePagination } from '../../common/utils/pagination';

export async function createDoctorController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await createDoctor(createDoctorSchema.parse(req.body));
    res.status(201).json({ success: true, data, message: 'Doctor created successfully' });
  } catch (err) { next(err); }
}

export async function getDoctorsController(req: Request, res: Response, next: NextFunction) {
  try {
    doctorQuerySchema.parse(req.query);
    const result = await getDoctors(parsePagination(req.query));
    res.json({ success: true, ...result, message: 'Doctors retrieved successfully' });
  } catch (err) { next(err); }
}

export async function getDoctorByIdController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getDoctorById(req.params.id);
    res.json({ success: true, data, message: 'Doctor retrieved successfully' });
  } catch (err) { next(err); }
}

export async function updateDoctorController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await updateDoctor(req.params.id, updateDoctorSchema.parse(req.body));
    res.json({ success: true, data, message: 'Doctor updated successfully' });
  } catch (err) { next(err); }
}

export async function deleteDoctorController(req: Request, res: Response, next: NextFunction) {
  try {
    await deleteDoctor(req.params.id);
    res.json({ success: true, data: null, message: 'Doctor deleted successfully' });
  } catch (err) { next(err); }
}

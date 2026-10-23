import bcrypt from 'bcryptjs';
import prisma from '../../common/prisma';
import { buildPaginationMeta, PaginationResult } from '../../common/utils/pagination';
import { AppError } from '../../common/middleware/errorHandler';
import { CreateDoctorInput, UpdateDoctorInput } from './doctors.schema';

const doctorSelect = {
  id: true,
  userId: true,
  specialty: true,
  user: { select: { email: true } },
};

export async function createDoctor(data: CreateDoctorInput) {
  const passwordHash = await bcrypt.hash(data.password, 12);
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email: data.email, passwordHash, role: 'doctor' },
    });
    return tx.doctor.create({
      data: { userId: user.id, specialty: data.specialty },
      select: doctorSelect,
    });
  });
}

export async function getDoctors({ page, limit, skip }: PaginationResult) {
  const [data, total] = await Promise.all([
    prisma.doctor.findMany({ skip, take: limit, orderBy: { id: 'asc' }, select: doctorSelect }),
    prisma.doctor.count(),
  ]);
  return { data, pagination: buildPaginationMeta(total, page, limit) };
}

export async function getDoctorById(id: string) {
  const doctor = await prisma.doctor.findUnique({ where: { id }, select: doctorSelect });
  if (!doctor) throw new AppError(404, 'Doctor not found');
  return doctor;
}

export async function updateDoctor(id: string, data: UpdateDoctorInput) {
  return prisma.doctor.update({ where: { id }, data, select: doctorSelect });
}

export async function deleteDoctor(id: string) {
  await prisma.$transaction(async (tx) => {
    const doctor = await tx.doctor.delete({ where: { id } });
    await tx.user.delete({ where: { id: doctor.userId } });
  });
}

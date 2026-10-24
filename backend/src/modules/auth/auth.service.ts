import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../common/prisma';
import { env } from '../../common/config/env';
import { AppError } from '../../common/middleware/errorHandler';

export interface TokenPayload {
  userId: string;
  role: string;
}

export function generateToken(user: { id: string; role: string }) {
  return jwt.sign({ userId: user.id, role: user.role }, env.JWT_SECRET as jwt.Secret, {
    expiresIn: env.JWT_EXPIRY as unknown as jwt.SignOptions['expiresIn'],
  });
}

export async function registerUser(data: { email: string; password: string }) {
  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) {
    throw new AppError(409, 'User with this email already exists');
  }

  const passwordHash = await bcrypt.hash(data.password, 12);
  const user = await prisma.user.create({
    data: {
      email: data.email,
      passwordHash,
      role: 'patient',
    },
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  return { user, token: generateToken(user) };
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError(401, 'Invalid email or password');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new AppError(401, 'Invalid email or password');
  }

  return {
    user: { id: user.id, email: user.email, role: user.role },
    token: generateToken(user),
  };
}

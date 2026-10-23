import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { registerUser, loginUser } from './auth.service';
import { AppError } from '../../common/middleware/errorHandler';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.literal('patient').optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function registerController(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = registerSchema.parse(req.body);
    const result = await registerUser(parsed);
    res.status(201).json({
      success: true,
      data: result,
      message: 'User registered successfully',
    });
  } catch (err) {
    next(err);
  }
}

export async function loginController(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = loginSchema.parse(req.body);
    const result = await loginUser(parsed.email, parsed.password);
    res.json({
      success: true,
      data: result,
      message: 'Login successful',
    });
  } catch (err) {
    next(err);
  }
}

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { requestId } from './common/middleware/requestId';
import { AppError, errorHandler } from './common/middleware/errorHandler';
import { authLimiter } from './common/middleware/rateLimiter';
import authRoutes from './modules/auth/auth.routes';
import patientsRoutes from './modules/patients/patients.routes';
import doctorsRoutes from './modules/doctors/doctors.routes';
import appointmentsRoutes from './modules/appointments/appointments.routes';
import { env } from './common/config/env';
import { logger } from './common/logger';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: true, credentials: true }));
  app.use(requestId);
  app.use(morgan('combined'));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use('/api/v1/auth', authLimiter, authRoutes);
  app.use('/api/v1/patients', patientsRoutes);
  app.use('/api/v1/doctors', doctorsRoutes);
  app.use('/api/v1/appointments', appointmentsRoutes);

  app.get('/health', (_req, res) => {
    res.json({ success: true, data: { status: 'ok', env: env.NODE_ENV } });
  });

  app.use((_req, _res, next) => {
    next(new AppError(404, 'Not Found'));
  });

  app.use(errorHandler);

  return app;
}

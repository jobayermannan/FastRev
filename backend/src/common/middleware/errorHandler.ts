import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { logger } from '../../common/logger';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public isOperational: boolean = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const requestId = (req as any).requestId as string | undefined;

  if (err instanceof AppError) {
    logger.error({ err, reqId: requestId }, err.message);
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      error: {
        code: String(err.statusCode),
        details: err.message,
      },
    });
  }

  if (err instanceof ZodError) {
    logger.error({ err, reqId: requestId }, 'Validation failed');
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      error: {
        code: '400',
        details: err.errors,
      },
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const status = err.code === 'P2025' ? 404 : err.code === 'P2002' || err.code === 'P2003' ? 409 : null;
    if (status !== null) {
      const message = status === 404 ? 'Resource not found' : 'Resource conflict';
      logger.warn({ reqId: requestId, prismaCode: err.code }, message);
      return res.status(status).json({
        success: false,
        message,
        error: { code: String(status), details: message },
      });
    }
  }

  const parserError = err as Error & { type?: string };
  if (parserError.type === 'entity.parse.failed') {
    logger.warn({ reqId: requestId }, 'Invalid request body');
    return res.status(400).json({
      success: false,
      message: 'Invalid request body',
      error: { code: '400', details: 'Invalid request body' },
    });
  }

  if (parserError.type === 'entity.too.large') {
    logger.warn({ reqId: requestId }, 'Request body too large');
    return res.status(413).json({
      success: false,
      message: 'Request body too large',
      error: { code: '413', details: 'Request body too large' },
    });
  }

  logger.error({ err, reqId: requestId }, 'Unhandled server error');
  return res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: {
      code: 'INTERNAL_ERROR',
      details: undefined,
    },
  });
};

import { Request, Response, NextFunction } from 'express';
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

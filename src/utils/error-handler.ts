import { AppError } from '../types';
import { logger } from './logger';

export class ErrorHandler {
  static handle(error: Error | AppError, context?: string): AppError {
    const timestamp = Date.now();
    
    if (error instanceof AppError) {
      logger.error(`${context ? `[${context}] ` : ''}${error.message}`, error.details);
      return error;
    }

    const appError: AppError = {
      code: 'UNKNOWN_ERROR',
      message: error.message || 'An unknown error occurred',
      details: error.stack,
      timestamp
    };

    logger.error(`${context ? `[${context}] ` : ''}${appError.message}`, appError.details);
    return appError;
  }

  static createError(code: string, message: string, details?: any): AppError {
    return {
      code,
      message,
      details,
      timestamp: Date.now()
    };
  }

  static isNetworkError(error: Error): boolean {
    return error.message.includes('network') || 
           error.message.includes('connection') ||
           error.message.includes('timeout');
  }

  static isValidationError(error: Error): boolean {
    return error.name === 'ValidationError';
  }
}
import { BaseError } from './BaseError.js';

/**
 * Authentication and authorization errors
 */
export class AuthError extends BaseError {
  constructor(message: string, statusCode: number = 401, details?: unknown) {
    super(message, 'AUTH_ERROR', statusCode, details);
  }
}

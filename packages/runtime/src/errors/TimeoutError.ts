import { BaseError } from './BaseError.js';

/**
 * Request timeout errors
 */
export class TimeoutError extends BaseError {
  constructor(message: string = 'Request timeout', timeoutMs?: number) {
    super(message, 'TIMEOUT_ERROR', 408, { timeoutMs });
  }
}

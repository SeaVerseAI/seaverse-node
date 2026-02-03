import { BaseError } from './BaseError.js';

/**
 * Network-related errors (connection, DNS, etc.)
 */
export class NetworkError extends BaseError {
  constructor(message: string, details?: unknown) {
    super(message, 'NETWORK_ERROR', undefined, details);
  }
}

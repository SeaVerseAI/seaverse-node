import { BaseError } from './BaseError.js';

/**
 * Protocol-level errors (invalid response format, etc.)
 */
export class ProtocolError extends BaseError {
  constructor(message: string, details?: unknown) {
    super(message, 'PROTOCOL_ERROR', undefined, details);
  }
}

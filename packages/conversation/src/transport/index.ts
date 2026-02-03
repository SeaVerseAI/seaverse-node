import { HttpClient } from './HttpClient.js';
import type { HttpClientConfig } from './config.types.js';

/**
 * Create an HTTP client with the given configuration
 */
export function createHttpClient(config: HttpClientConfig): HttpClient {
  return new HttpClient(config);
}

// Re-exports
export { HttpClient } from './HttpClient.js';
export type { HttpClientConfig } from './config.types.js';
export { withTimeout, createTimeoutPromise } from './timeout.js';

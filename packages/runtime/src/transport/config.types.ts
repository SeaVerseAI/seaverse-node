import type { TokenProvider } from '../types/token.types.js';
import type {
  OnRequestHook,
  OnResponseHook,
  OnErrorHook,
} from '../types/http.types.js';

/**
 * HTTP client configuration
 */
export interface HttpClientConfig {
  /**
   * Base URL for all requests
   */
  baseUrl: string;

  /**
   * Custom fetch implementation (defaults to global fetch)
   */
  fetch?: typeof fetch;

  /**
   * Token provider function
   */
  getAuthToken?: TokenProvider;

  /**
   * Request timeout in milliseconds (default: 30000)
   */
  timeoutMs?: number;

  /**
   * Default headers to include in all requests
   */
  defaultHeaders?: Record<string, string>;

  /**
   * Hook called before request is sent
   */
  onRequest?: OnRequestHook;

  /**
   * Hook called after successful response
   */
  onResponse?: OnResponseHook;

  /**
   * Hook called on error
   */
  onError?: OnErrorHook;
}

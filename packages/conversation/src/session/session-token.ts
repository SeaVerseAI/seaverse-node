import { AuthError } from '../errors/AuthError.js';

/**
 * Configuration for URL session token generation
 */
export interface UrlSessionTokenConfig {
  /**
   * Auth service base URL
   * @default "https://auth.sg.seaverse.dev"
   */
  authBaseUrl?: string;

  /**
   * Access token for authentication
   */
  accessToken: string;

  /**
   * Custom fetch implementation (defaults to global fetch)
   */
  fetch?: typeof fetch;

  /**
   * Request timeout in milliseconds
   * @default 10000
   */
  timeoutMs?: number;
}

/**
 * Response format from auth service
 */
interface UrlSessionTokenResponse {
  code: number;
  message: string;
  data?: {
    url_session_token?: string;
  };
}

/**
 * Get URL session token from auth service
 * Browser-compatible version (no process.env)
 *
 * @param config - Configuration object
 * @returns URL session token or null if failed
 *
 * @example
 * const token = await getUrlSessionToken({
 *   accessToken: 'user-access-token',
 *   authBaseUrl: 'https://auth.sg.seaverse.dev'
 * });
 */
export async function getUrlSessionToken(
  config: UrlSessionTokenConfig
): Promise<string | null> {
  const {
    authBaseUrl = 'https://auth.sg.seaverse.dev',
    accessToken,
    fetch: customFetch = globalThis.fetch,
    timeoutMs = 10000,
  } = config;

  const startTime = Date.now();

  try {
    if (!accessToken) {
      console.warn('[getUrlSessionToken] No access token provided');
      return null;
    }

    const endpoint = `${authBaseUrl}/api/v1/url-session/generate`;

    // Create timeout signal
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await customFetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: '',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const elapsed = Date.now() - startTime;

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new AuthError(
            `Auth failed: ${response.statusText}`,
            response.status
          );
        }

        console.error(
          `[getUrlSessionToken] Failed: ${response.status} ${response.statusText} (${elapsed}ms)`
        );
        return null;
      }

      const data: UrlSessionTokenResponse = await response.json();
      const urlSessionToken = data.data?.url_session_token || null;

      if (urlSessionToken) {
        console.log(`[getUrlSessionToken] Success: got token (${elapsed}ms)`);
      } else {
        console.warn(
          `[getUrlSessionToken] Response OK but no url_session_token in data (${elapsed}ms)`,
          data
        );
      }

      return urlSessionToken;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        console.error(`[getUrlSessionToken] Timeout after ${timeoutMs}ms`);
        return null;
      }

      throw error;
    }
  } catch (error) {
    const elapsed = Date.now() - startTime;

    if (error instanceof AuthError) {
      throw error;
    }

    console.error(`[getUrlSessionToken] Error (${elapsed}ms):`, error);
    return null;
  }
}

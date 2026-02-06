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

// ─── 客户端缓存 & 请求去重 ───────────────────────────────────
// url_session_token 有效期较长，客户端缓存 5 分钟可大幅减少对 auth 服务的请求
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 分钟

/** 缓存的 token 值 */
let cachedToken: string | null = null;
/** 缓存过期时间戳 */
let cacheExpiry = 0;
/** 按 accessToken 去重的 pending promise（同一 accessToken 同一时刻只发一次请求） */
let pendingRequest: Promise<string | null> | null = null;

/**
 * 清除 url_session_token 缓存
 * 在 token 失效或用户登出时调用
 */
export function clearUrlSessionTokenCache(): void {
  cachedToken = null;
  cacheExpiry = 0;
  pendingRequest = null;
}

/**
 * Get URL session token from auth service
 * Browser-compatible version (no process.env)
 *
 * 内置客户端缓存（TTL 5 分钟）和请求去重（同时多次调用只发一次网络请求）。
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
    accessToken,
  } = config;

  if (!accessToken) {
    console.warn('[getUrlSessionToken] No access token provided');
    return null;
  }

  // 1. 命中缓存：token 未过期则直接返回
  if (cachedToken && Date.now() < cacheExpiry) {
    return cachedToken;
  }

  // 2. 请求去重：已有进行中的请求则复用其 Promise
  if (pendingRequest) {
    return pendingRequest;
  }

  // 3. 发起实际请求，缓存 Promise 用于去重
  pendingRequest = fetchUrlSessionToken(config)
    .then((token) => {
      if (token) {
        cachedToken = token;
        cacheExpiry = Date.now() + CACHE_TTL_MS;
      }
      return token;
    })
    .finally(() => {
      pendingRequest = null;
    });

  return pendingRequest;
}

/**
 * 实际发起 HTTP 请求获取 url_session_token（内部方法）
 */
async function fetchUrlSessionToken(
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
          // 认证失败时清除缓存，下次会重新获取
          clearUrlSessionTokenCache();
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

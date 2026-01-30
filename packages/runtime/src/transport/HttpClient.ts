import {
  BaseError,
  NetworkError,
  AuthError,
  ProtocolError,
} from '../errors/index.js';
import type {
  HttpRequestConfig,
  HttpResponse,
} from '../types/http.types.js';
import type { HttpClientConfig } from './config.types.js';
import { withTimeout } from './timeout.js';

/**
 * HTTP client for making requests
 */
export class HttpClient {
  private readonly config: Required<HttpClientConfig>;

  constructor(config: HttpClientConfig) {
    // 注意：在某些浏览器/运行时环境中，直接保存 `window.fetch` 的函数引用再调用
    // 可能触发 "Illegal invocation"（this 绑定丢失）。这里对默认 fetch 做显式绑定，
    // 避免在测试页/嵌入式 WebView 等场景报错。
    const defaultFetch = globalThis.fetch ? globalThis.fetch.bind(globalThis) : undefined;

    this.config = {
      baseUrl: config.baseUrl.replace(/\/$/, ''), // Remove trailing slash
      fetch: config.fetch || (defaultFetch as typeof fetch),
      getAuthToken: config.getAuthToken || (() => null),
      timeoutMs: config.timeoutMs || 30000,
      defaultHeaders: config.defaultHeaders || {},
      onRequest: config.onRequest || (() => {}),
      onResponse: config.onResponse || (() => {}),
      onError: config.onError || (() => {}),
    };
  }

  /**
   * Make an HTTP request
   */
  async request<T = unknown>(
    path: string,
    options: HttpRequestConfig = {}
  ): Promise<HttpResponse<T>> {
    const url = `${this.config.baseUrl}${path}`;
    const method = options.method || 'GET';

    try {
      // Build headers
      const headers: Record<string, string> = {
        ...this.config.defaultHeaders,
        ...options.headers,
      };

      // Add auth token if available
      const token = await this.config.getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Add content-type for JSON body
      if (options.body && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }

      // Call onRequest hook
      await this.config.onRequest({ url, method, headers, body: options.body });

      // Prepare fetch options
      const fetchOptions: RequestInit = {
        method,
        headers,
        signal: options.signal,
      };

      if (options.body) {
        fetchOptions.body = typeof options.body === 'string'
          ? options.body
          : JSON.stringify(options.body);
      }

      // Make request with timeout
      const response = await withTimeout(
        this.config.fetch(url, fetchOptions),
        this.config.timeoutMs
      );

      // Parse response body
      let data: T;
      const contentType = response.headers.get('content-type');

      if (contentType?.includes('application/json')) {
        // `response.json()` is typed as `any/unknown` depending on TS lib; we
        // intentionally trust the caller's generic `T` here.
        data = (await response.json()) as T;
      } else if (contentType?.includes('text/')) {
        data = await response.text() as T;
      } else {
        data = await response.blob() as T;
      }

      // Handle error responses
      if (!response.ok) {
        // PostgREST 在分页超出范围时可能返回 416（Range Not Satisfiable）。
        // 这类响应对上层“分页查询”来说应被视为“空结果页”，由调用方结合 Content-Range 自行计算 pagination。
        // 因此这里对 416 做透传，不抛异常。
        if (response.status !== 416) {
          await this.handleErrorResponse(response, data);
        }
      }

      const result: HttpResponse<T> = {
        data,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      };

      // Call onResponse hook
      await this.config.onResponse({
        url,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data,
      });

      return result;
    } catch (error) {
      // Call onError hook
      if (error instanceof BaseError) {
        await this.config.onError({
          url,
          message: error.message,
          statusCode: error.statusCode,
          details: error.details,
        });
      } else if (error instanceof Error) {
        await this.config.onError({
          url,
          message: error.message,
        });
      }

      throw error;
    }
  }

  /**
   * Handle error responses
   */
  private async handleErrorResponse(
    response: Response,
    data: unknown
  ): Promise<never> {
    const status = response.status;

    // Auth errors
    if (status === 401 || status === 403) {
      throw new AuthError(
        `Authentication failed: ${response.statusText}`,
        status,
        data
      );
    }

    // Network errors
    if (status >= 500) {
      throw new NetworkError(
        `Server error: ${response.statusText}`,
        data
      );
    }

    // Protocol errors
    throw new ProtocolError(
      `HTTP ${status}: ${response.statusText}`,
      data
    );
  }

  /**
   * GET request
   */
  async get<T = unknown>(
    path: string,
    options?: Omit<HttpRequestConfig, 'method' | 'body'>
  ): Promise<HttpResponse<T>> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  /**
   * POST request
   */
  async post<T = unknown>(
    path: string,
    body?: unknown,
    options?: Omit<HttpRequestConfig, 'method' | 'body'>
  ): Promise<HttpResponse<T>> {
    return this.request<T>(path, { ...options, method: 'POST', body });
  }

  /**
   * PATCH request
   */
  async patch<T = unknown>(
    path: string,
    body?: unknown,
    options?: Omit<HttpRequestConfig, 'method' | 'body'>
  ): Promise<HttpResponse<T>> {
    return this.request<T>(path, { ...options, method: 'PATCH', body });
  }

  /**
   * DELETE request
   */
  async delete<T = unknown>(
    path: string,
    options?: Omit<HttpRequestConfig, 'method' | 'body'>
  ): Promise<HttpResponse<T>> {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }
}

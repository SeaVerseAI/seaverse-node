/**
 * HTTP request configuration
 */
export interface HttpRequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
}

/**
 * HTTP response type
 */
export interface HttpResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
}

/**
 * HTTP request hook - called before request is sent
 */
export type OnRequestHook = (config: {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
}) => void | Promise<void>;

/**
 * HTTP response hook - called after response is received
 */
export type OnResponseHook = (response: {
  url: string;
  status: number;
  statusText: string;
  headers: Headers;
  data: unknown;
}) => void | Promise<void>;

/**
 * HTTP error hook - called when request fails
 */
export type OnErrorHook = (error: {
  url: string;
  message: string;
  statusCode?: number;
  details?: unknown;
}) => void | Promise<void>;

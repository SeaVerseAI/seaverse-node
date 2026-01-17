/**
 * Copyright 2026 SeaVerse AI
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { client } from './client.gen';

/**
 * Default base URL for account API
 */
export const DEFAULT_BASE_URL = 'https://account.seaverse.ai';

/**
 * Client configuration options
 */
export interface ClientConfig {
  /**
   * Base URL for API requests
   * @default 'https://account.seaverse.ai'
   */
  baseUrl?: string;

  /**
   * Additional headers to include in requests
   */
  headers?: Record<string, string>;
}

/**
 * Create a new account API client with optional configuration.
 *
 * @param config - Client configuration options
 * @returns Configured API client
 *
 * @example
 * // Use default endpoint
 * import { createClient } from '@seaverse/account';
 * const client = createClient();
 *
 * @example
 * // Override with custom endpoint
 * const client = createClient({
 *   baseUrl: 'https://custom.api.com',
 *   headers: { 'X-Custom-Header': 'value' }
 * });
 */
export function createClient(config?: ClientConfig) {
  client.setConfig({
    baseUrl: config?.baseUrl || DEFAULT_BASE_URL,
    headers: {
      'User-Agent': 'seaverse-account-node/1.0.0',
      ...config?.headers,
    },
  });
  return client;
}

// Re-export for convenience
export { client };
export * from './types.gen';
export * from './sdk.gen';

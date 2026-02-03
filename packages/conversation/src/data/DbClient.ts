import type { HttpClient } from '../transport/HttpClient.js';
import type { QueryOptions, MutationOptions } from './query.types.js';
import { buildPostgrestHeaders, buildQueryString } from './postgrest-headers.js';

/**
 * 带总数的查询结果
 */
export interface QueryResultWithCount<T> {
  data: T[];
  count: number | null;
}

/**
 * Simple PostgREST database client
 */
export class DbClient {
  constructor(private readonly http: HttpClient) {}

  /**
   * Get multiple rows from a table
   *
   * @example
   * const conversations = await db.get('conversations', {
   *   filter: { user_id: 'eq.123' },
   *   order: 'created_at.desc',
   *   limit: 10
   * });
   *
   * @example
   * // With count
   * const result = await db.get('conversations', {
   *   filter: { user_id: 'eq.123' },
   *   limit: 10,
   *   count: 'exact'
   * });
   * console.log(result.count); // Total count
   * console.log(result.data); // Page data
   */
  async get<T = unknown>(
    table: string,
    options: QueryOptions = {}
  ): Promise<QueryResultWithCount<T>> {
    const query = buildQueryString(options);
    const headers = buildPostgrestHeaders(options);

    const response = await this.http.get<T[]>(`/${table}${query}`, { headers });

    // 解析 Content-Range header 获取总数
    // Format: "0-9/total" or "0-9/*" (if no count requested)
    let count: number | null = null;
    const contentRange = response.headers.get('Content-Range');
    if (contentRange && options.count) {
      const match = contentRange.match(/\/(\d+)$/);
      if (match) {
        count = parseInt(match[1], 10);
      }
    }

    return {
      // PostgREST：当 offset 超出范围时，可能返回 416（Range Not Satisfiable）。
      // 在这种情况下，上层分页应得到空数组，而不是抛异常。
      data: response.status === 416 ? [] : response.data,
      count,
    };
  }

  /**
   * Get a single row from a table
   *
   * @example
   * const conversation = await db.getOne('conversations', {
   *   filter: { id: 'eq.123' }
   * });
   */
  async getOne<T = unknown>(
    table: string,
    options: QueryOptions = {}
  ): Promise<T | null> {
    const results = await this.get<T>(table, {
      ...options,
      limit: 1,
    });

    return results.data[0] || null;
  }

  /**
   * Insert one or more rows into a table
   *
   * @example
   * const newConversation = await db.post('conversations', {
   *   app_id: 'xxx',
   *   user_id: 'yyy'
   * }, {
   *   returning: 'representation'
   * });
   */
  async post<T = unknown>(
    table: string,
    data: unknown,
    options: MutationOptions = {}
  ): Promise<T[]> {
    const headers = buildPostgrestHeaders(options);

    const response = await this.http.post<T[]>(`/${table}`, data, { headers });

    return response.data;
  }

  /**
   * Update rows in a table
   *
   * @example
   * const updated = await db.patch('conversations',
   *   { id: 'eq.123' },
   *   { title: 'New Title' }
   * );
   */
  async patch<T = unknown>(
    table: string,
    filter: Record<string, string>,
    data: unknown,
    options: MutationOptions = {}
  ): Promise<T[]> {
    const query = buildQueryString({ filter });
    const headers = buildPostgrestHeaders(options);

    const response = await this.http.patch<T[]>(`/${table}${query}`, data, { headers });

    return response.data;
  }

  /**
   * Delete rows from a table
   *
   * @example
   * await db.delete('conversations', { id: 'eq.123' });
   */
  async delete(
    table: string,
    filter: Record<string, string>
  ): Promise<void> {
    const query = buildQueryString({ filter });

    await this.http.delete(`/${table}${query}`);
  }
}

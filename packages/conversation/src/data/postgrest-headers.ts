import type { QueryOptions, MutationOptions } from './query.types.js';

/**
 * Build PostgREST headers from query options
 */
export function buildPostgrestHeaders(
  options: QueryOptions | MutationOptions = {}
): Record<string, string> {
  const headers: Record<string, string> = {};

  // Count preference
  if ('count' in options && options.count) {
    headers['Prefer'] = `count=${options.count}`;
  }

  // Mutation preferences
  if ('returning' in options) {
    const prefer: string[] = [];

    if (options.returning) {
      prefer.push(`return=${options.returning}`);
    }

    if (options.resolution) {
      prefer.push(`resolution=${options.resolution}`);
    }

    if (options.missing) {
      prefer.push(`missing=${options.missing}`);
    }

    if (prefer.length > 0) {
      headers['Prefer'] = prefer.join(',');
    }
  }

  return headers;
}

/**
 * Build query string from filter options
 */
export function buildQueryString(options: QueryOptions = {}): string {
  const params = new URLSearchParams();

  // Select columns
  if (options.select) {
    params.set('select', options.select);
  }

  // Filters
  if (options.filter) {
    for (const [key, value] of Object.entries(options.filter)) {
      params.set(key, value);
    }
  }

  // Order
  if (options.order) {
    params.set('order', options.order);
  }

  // Limit
  if (options.limit !== undefined) {
    params.set('limit', String(options.limit));
  }

  // Offset
  if (options.offset !== undefined) {
    params.set('offset', String(options.offset));
  }

  const query = params.toString();
  return query ? `?${query}` : '';
}

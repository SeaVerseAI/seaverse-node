/**
 * PostgREST query options
 */
export interface QueryOptions {
  /**
   * Columns to select (default: *)
   * @example "id,name,created_at"
   * @example "*,conversations(*)"
   */
  select?: string;

  /**
   * Filter conditions
   * @example { id: "eq.123", status: "neq.deleted" }
   */
  filter?: Record<string, string>;

  /**
   * Order by clause
   * @example "created_at.desc"
   * @example "name.asc,created_at.desc"
   */
  order?: string;

  /**
   * Limit number of results
   */
  limit?: number;

  /**
   * Offset for pagination
   */
  offset?: number;

  /**
   * Count mode
   * - "exact": Return exact count in Content-Range header
   * - "planned": Return estimated count
   * - "estimated": Return estimated count
   */
  count?: 'exact' | 'planned' | 'estimated';
}

/**
 * PostgREST insert/update options
 */
export interface MutationOptions {
  /**
   * What to return after mutation
   * - "representation": Return the modified rows
   * - "minimal": Return nothing
   * - "headers-only": Return only headers
   */
  returning?: 'representation' | 'minimal' | 'headers-only';

  /**
   * Resolution strategy for conflicts
   * - "merge-duplicates": Merge duplicate rows
   * - "ignore-duplicates": Ignore conflicts
   */
  resolution?: 'merge-duplicates' | 'ignore-duplicates';

  /**
   * Missing columns
   * - "default": Use default values
   * - "null": Use null values
   */
  missing?: 'default' | 'null';
}

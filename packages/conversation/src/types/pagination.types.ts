/**
 * 分页元数据
 */
export interface PaginationMeta {
  /**
   * 总记录数
   */
  total: number;

  /**
   * 当前页码（从 1 开始）
   */
  page: number;

  /**
   * 每页数量
   */
  pageSize: number;

  /**
   * 总页数
   */
  totalPages: number;

  /**
   * 是否有下一页
   */
  hasNextPage: boolean;

  /**
   * 是否有上一页
   */
  hasPreviousPage: boolean;
}

/**
 * 分页结果
 */
export interface PaginatedResult<T> {
  /**
   * 数据列表
   */
  data: T[];

  /**
   * 分页元数据
   */
  pagination: PaginationMeta;
}

/**
 * 分页选项（基于 page/pageSize）
 */
export interface PaginationOptions {
  /**
   * 页码（从 1 开始）
   * @default 1
   */
  page?: number;

  /**
   * 每页数量
   * @default 20
   */
  pageSize?: number;
}

/**
 * 计算分页元数据
 */
export function calculatePaginationMeta(
  total: number,
  page: number,
  pageSize: number
): PaginationMeta {
  const totalPages = Math.ceil(total / pageSize);

  return {
    total,
    page,
    pageSize,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

/**
 * 将 page/pageSize 转换为 limit/offset
 */
export function pageToOffset(page: number, pageSize: number): { limit: number; offset: number } {
  return {
    limit: pageSize,
    offset: (page - 1) * pageSize,
  };
}

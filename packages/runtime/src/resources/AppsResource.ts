import type { DbClient } from '../data/DbClient.js';
import type { App, DbSchema } from '../types/models.types.js';
import type { PaginationOptions, PaginatedResult } from '../types/pagination.types.js';
import { calculatePaginationMeta, pageToOffset } from '../types/pagination.types.js';
import { transformApp } from '../transforms/app.transform.js';

/**
 * 应用列表查询选项
 */
export interface ListAppsOptions extends PaginationOptions {
  /**
   * 按用户 ID 过滤
   */
  userId?: string;

  /**
   * 按状态过滤
   */
  status?: 'draft' | 'published' | 'archived';

  /**
   * 排序方向
   * @default 'desc'
   */
  order?: 'asc' | 'desc';
}

/**
 * 应用资源类
 */
export class AppsResource {
  constructor(private readonly db: DbClient) {}

  /**
   * 列出应用（带分页）
   */
  async list(options: ListAppsOptions = {}): Promise<PaginatedResult<App>> {
    // 分页参数
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const { limit, offset } = pageToOffset(page, pageSize);

    // 构建过滤条件
    const filter: Record<string, string> = {};
    if (options.userId) filter.user_id = `eq.${options.userId}`;
    if (options.status) filter.status = `eq.${options.status}`;

    const dbApps = await this.db.get<DbSchema.App>('apps', {
      filter,
      order: `created_at.${options.order || 'desc'}`,
      limit,
      offset,
      count: 'exact',
    });

    // 获取总数（从响应头）
    const total = dbApps.count || 0;
    const pagination = calculatePaginationMeta(total, page, pageSize);

    return {
      data: dbApps.data.map(transformApp),
      pagination,
    };
  }

  /**
   * 获取单个应用
   */
  async get(id: string): Promise<App | null> {
    const dbApp = await this.db.getOne<DbSchema.App>('apps', {
      filter: { app_id: `eq.${id}` },
    });

    if (!dbApp) return null;

    return transformApp(dbApp);
  }
}

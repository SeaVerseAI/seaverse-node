import type { DbClient } from '../data/DbClient.js';
import type {
  Conversation,
  AppWithConversations,
  ListAppsWithConversationsResult,
  DbSchema
} from '../types/models.types.js';
import type { PaginationOptions, PaginatedResult } from '../types/pagination.types.js';
import { calculatePaginationMeta, pageToOffset } from '../types/pagination.types.js';
import { transformConversation, toDbConversation } from '../transforms/conversation.transform.js';
import { transformApp } from '../transforms/app.transform.js';

/**
 * 会话列表查询选项
 */
export interface ListConversationsOptions extends PaginationOptions {
  /**
   * 按应用 ID 过滤
   */
  appId?: string;

  /**
   * 按用户 ID 过滤
   */
  userId?: string;

  /**
   * 排序字段
   * @default 'createdAt'
   */
  orderBy?: 'createdAt' | 'updatedAt' | 'lastActiveAt';

  /**
   * 排序方向
   * @default 'desc'
   */
  order?: 'asc' | 'desc';
}

/**
 * 创建会话数据
 */
export interface CreateConversationData {
  title: string;
  appId?: string | null;
  userId: string;
}

/**
 * 更新会话数据
 */
export interface UpdateConversationData {
  title?: string;
}

/**
 * 会话资源类
 */
export class ConversationsResource {
  constructor(
    private readonly db: DbClient,
    private readonly getUrlSessionToken: () => Promise<string | null>
  ) {}

  /**
   * 列出会话（带分页）
   */
  async list(options: ListConversationsOptions = {}): Promise<PaginatedResult<Conversation>> {
    // 分页参数
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const { limit, offset } = pageToOffset(page, pageSize);

    // 构建过滤条件
    const filter: Record<string, string> = {};
    if (options.appId) filter.app_id = `eq.${options.appId}`;
    if (options.userId) filter.user_id = `eq.${options.userId}`;

    // 构建排序
    const orderField =
      options.orderBy === 'lastActiveAt' ? 'last_message_created_at' :
      options.orderBy === 'updatedAt' ? 'updated_at' :
      'created_at';
    const order = `${orderField}.${options.order || 'desc'}`;

    const dbConversations = await this.db.get<DbSchema.Conversation>('conversations', {
      filter,
      order,
      limit,
      offset,
      count: 'exact',
    });

    // 获取总数（从响应头）
    const total = dbConversations.count || 0;
    const pagination = calculatePaginationMeta(total, page, pageSize);

    return {
      data: dbConversations.data.map(conv => transformConversation(conv)),
      pagination,
    };
  }

  /**
   * 获取单个会话
   */
  async get(id: string): Promise<Conversation | null> {
    const dbConv = await this.db.getOne<DbSchema.Conversation>('conversations', {
      filter: { id: `eq.${id}` },
    });

    if (!dbConv) return null;

    return transformConversation(dbConv);
  }

  /**
   * 创建会话
   */
  async create(data: CreateConversationData): Promise<Conversation> {
    const dbData = toDbConversation({
      title: data.title,
      appId: data.appId,
      userId: data.userId,
    });

    const results = await this.db.post<DbSchema.Conversation>('conversations', dbData, {
      returning: 'representation',
    });

    const dbConv = results[0];

    // 获取 url_session_token
    const urlSessionToken = await this.getUrlSessionToken();

    return transformConversation(dbConv, urlSessionToken || undefined);
  }

  /**
   * 更新会话
   */
  async update(id: string, data: UpdateConversationData): Promise<Conversation> {
    const dbData = toDbConversation(data);

    const results = await this.db.patch<DbSchema.Conversation>(
      'conversations',
      { id: `eq.${id}` },
      dbData,
      { returning: 'representation' }
    );

    return transformConversation(results[0]);
  }

  /**
   * 删除会话
   */
  async delete(id: string): Promise<void> {
    await this.db.delete('conversations', { id: `eq.${id}` });
  }

  /**
   * 聚合查询：获取应用及其会话列表
   *
   * 替代 builder-sdk 的 GET /api/apps/with-conversations
   * 直接从 PostgREST 和 auth service 并行获取数据
   */
  async listAppsWithConversations(options?: {
    appId?: string;
    userId?: string;
  }): Promise<ListAppsWithConversationsResult> {
    // 构建查询过滤
    const appFilter: Record<string, string> = {};
    const convFilter: Record<string, string> = {};

    if (options?.appId) {
      appFilter.app_id = `eq.${options.appId}`;
      convFilter.app_id = `eq.${options.appId}`;
    }

    if (options?.userId) {
      convFilter.user_id = `eq.${options.userId}`;
    }

    // 并行请求（避免瀑布流）
    const [dbAppsResult, dbConversationsResult, urlSessionToken] = await Promise.all([
      this.db.get<DbSchema.App>('apps', { filter: appFilter }),
      this.db.get<DbSchema.Conversation>('conversations', { filter: convFilter }),
      this.getUrlSessionToken(),
    ]);

    // 按 app_id 分组会话
    const conversationsByAppId = new Map<string, Conversation[]>();
    const globalConversations: Conversation[] = [];

    for (const dbConv of dbConversationsResult.data) {
      const conv = transformConversation(dbConv, urlSessionToken || undefined);

      if (conv.appId) {
        const existing = conversationsByAppId.get(conv.appId) || [];
        existing.push(conv);
        conversationsByAppId.set(conv.appId, existing);
      } else {
        globalConversations.push(conv);
      }
    }

    // 构建结果
    const apps: AppWithConversations[] = dbAppsResult.data.map(dbApp => ({
      app: transformApp(dbApp),
      conversations: conversationsByAppId.get((dbApp.app_id || dbApp.id) as string) || [],
    }));

    return {
      urlSessionToken,
      apps,
      globalConversations,
    };
  }
}

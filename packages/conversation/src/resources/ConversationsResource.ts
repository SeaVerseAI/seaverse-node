import type { DbClient } from '../data/DbClient.js';
import type {
  Conversation,
  ConversationResponse,
  AppWithConversations,
  ListAppsWithConversationsResult,
  DbSchema
} from '../types/models.types.js';
import type { PaginationOptions, PaginatedResult } from '../types/pagination.types.js';
import { calculatePaginationMeta, pageToOffset } from '../types/pagination.types.js';
import { transformConversation, toDbConversation, toConversationResponse } from '../transforms/conversation.transform.js';
import { transformApp } from '../transforms/app.transform.js';
import { listAppsWithConversations as listAppsWithConversationsAggregated } from '../aggregated/apps-with-conversations.js';

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
    private readonly db: DbClient
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
    const now = Math.floor(Date.now() / 1000); // 秒时间戳
    
    // 生成唯一的 conversation_id（格式与 runtime-plugins 一致）
    const conversationId = crypto.randomUUID();

    // 构建完整的数据库数据（匹配 runtime-plugins 的实现）
    const fullDbData = {
      conversation_id: conversationId,
      app_id: data.appId || null,
      backend: 'seaverse',
      backend_session_id: null,
      title: data.title || 'New Conversation',
      created_at: now,
      updated_at: now,
      message_count: 0,
      user_id: data.userId,
    };

    const results = await this.db.post<DbSchema.Conversation>('conversations', fullDbData, {
      returning: 'representation',
    });

    const dbConv = results[0];

    return transformConversation(dbConv);
  }

  /**
   * 创建会话并返回 API 响应格式（snake_case）
   */
  async createWithResponse(data: CreateConversationData): Promise<ConversationResponse> {
    const now = Math.floor(Date.now() / 1000); // 秒时间戳
    
    // 生成唯一的 conversation_id（格式与 runtime-plugins 一致）
    const conversationId = crypto.randomUUID();

    // 构建完整的数据库数据（匹配 runtime-plugins 的实现）
    const fullDbData = {
      conversation_id: conversationId,
      app_id: data.appId || null,
      backend: 'seaverse',
      backend_session_id: null,
      title: data.title || 'New Conversation',
      created_at: now,
      updated_at: now,
      message_count: 0,
      // user_id 由 RLS trigger 自动填充，但我们也传递以备用
      user_id: data.userId,
    };

    const results = await this.db.post<DbSchema.Conversation>('conversations', fullDbData, {
      returning: 'representation',
    });

    const dbConv = results[0];

    return toConversationResponse(dbConv);
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
   * 每个 app 只返回 message_count 最大的会话
   *
   * 替代 builder-sdk 的 GET /api/apps/with-conversations
   * 直接从 PostgREST 并行获取数据
   */
  async listAppsWithConversations(options?: {
    appId?: string;
    userId?: string;
    page?: number;
    pageSize?: number;
  }): Promise<ListAppsWithConversationsResult> {
    // 注意：这里暂时忽略 userId 过滤，因为聚合函数还不支持
    // TODO: 在 apps-with-conversations.ts 中添加 userId 过滤支持

    return await listAppsWithConversationsAggregated({
      appId: options?.appId,
      page: options?.page,
      pageSize: options?.pageSize,
      db: this.db,
    });
  }
}

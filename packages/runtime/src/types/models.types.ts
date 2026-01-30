/**
 * 前端业务模型（camelCase 格式）
 */

/**
 * 会话模型
 */
export interface Conversation {
  id: string;
  title: string;
  appId: string | null;
  userId: string;
  createdAt: number;        // 毫秒时间戳
  updatedAt: number;        // 毫秒时间戳
  lastActiveAt: number;     // 毫秒时间戳
  urlSessionToken?: string;
}

/**
 * 消息模型
 */
export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;        // 毫秒时间戳
  metadata?: Record<string, unknown>;
}

/**
 * 应用模型（仅包含实际使用的字段）
 */
export interface App {
  id: string;
  name: string;
  displayName: string;
  description: string;
  thumbnailUrls: string[];
  userName: string;
  version: string;
  tags: string[] | null;
  status: 'draft' | 'published' | 'archived';
  positiveCount: number;
  forkCount: number;
  commentCount: number;
  createdAt: number;        // 毫秒时间戳
  updatedAt: number;        // 毫秒时间戳
}

/**
 * 应用与会话聚合结果
 */
export interface AppWithConversations {
  app: App;
  conversations: Conversation[];
}

/**
 * 列表查询结果
 */
export interface ListAppsWithConversationsResult {
  urlSessionToken: string | null;
  apps: AppWithConversations[];
  globalConversations: Conversation[];
}

/**
 * 数据库原始模型（snake_case 格式，内部使用）
 */
export namespace DbSchema {
  export interface Conversation {
    // 实际表字段：conversation_id；为兼容历史实现，保留 id 可选
    conversation_id?: string;
    id?: string;
    app_id: string | null;
    user_id: string;
    title: string;
    created_at: number;                // 秒时间戳
    updated_at: number;                // 秒时间戳
    last_message_created_at?: number;  // 秒时间戳
    message_count?: number;
  }

  export interface Message {
    id: string;
    conversation_id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    created_at: number;  // 秒时间戳
    metadata?: unknown;
  }

  export interface App {
    // 真实表字段（snake_case）
    app_id?: string;
    app_name?: string;
    description?: string;
    template?: string;
    created_at?: string | number;
    updated_at?: string | number;
    metadata?: Record<string, unknown>;
    user_id?: string;

    // 兼容旧字段（如果后端切换/历史数据）
    id?: string;
    name?: string;
    display_name?: string;
    thumbnail_urls?: string[];
    user_name?: string;
    version?: string;
    tags?: string[] | null;
    status?: 'draft' | 'published' | 'archived';
    positive_count?: number;
    fork_count?: number;
    comment_count?: number;
  }
}

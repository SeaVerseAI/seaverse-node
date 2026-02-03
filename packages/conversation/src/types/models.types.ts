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
  messageCount?: number;    // 消息计数
}

/**
 * 工具调用信息
 */
export interface ToolCall {
  id: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  isCompleted: boolean;
}

/**
 * 消息模型（兼容旧 API 格式）
 */
export interface Message {
  id: string;
  // conversationId 字段在普通消息中不返回，仅在 tips 消息中使用 conversation_id
  conversationId?: string;
  role?: 'user' | 'assistant' | 'system';  // 可选，tips 消息无 role
  content?: string;         // 可选，tips 消息不返回 content
  timestamp: number;        // 秒时间戳（旧 API 格式）
  type?: 'text' | 'conversation_tips' | string;  // 消息类型
  tips?: string[];          // 用于 type='conversation_tips'
  toolCalls?: ToolCall[];   // 用于包含工具调用的消息
  // metadata 字段不返回给前端（旧 API 格式）
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
  apps: AppWithConversations[];
  hasMore: boolean;  // 是否还有下一页
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
    // 兼容：数据库可能返回 message_id 或 id
    message_id?: string;
    id?: string;
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

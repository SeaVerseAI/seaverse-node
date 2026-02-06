/**
 * 前端业务模型（camelCase 格式）
 */

/**
 * 会话模型（camelCase，内部使用）
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
 * 会话响应模型（snake_case，匹配 runtime-plugins 格式）
 */
export interface ConversationResponse {
  conversation_id: string;
  app_id: string | null;
  backend: string;
  backend_session_id: string | null;
  title: string;
  created_at: number;       // 秒时间戳
  updated_at: number;       // 秒时间戳
  message_count: number;
  skills_json: any | null;
  metadata: Record<string, unknown>;
  user_id: string;
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
 * 媒体资源（API 格式：{ images, audios, videos }）
 * 前端 normalizeMedia 会将其转换为 MediaItem[] 格式
 */
export interface MessageMedia {
  images?: string[];
  audios?: string[];
  videos?: string[];
}

/**
 * 待办事项
 */
export interface TodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | string;
}

/**
 * 消息附件
 */
export interface MessageAttachment {
  type: 'image' | 'document' | string;
  media_type?: string;
  file_id?: string;
  filename?: string;
  url?: string;
  size?: number;
  path?: string;
}

/**
 * 消息模型（兼容旧 API 格式）
 *
 * 采用「全量透传」策略，完全对齐 runtime-plugins/conversations getMessages 行为：
 * content 中的 JSON 对象会被整体展开，所有字段都保留。
 *
 * 下方显式声明的是已知字段（提供类型安全和 IDE 提示），
 * 索引签名 [key: string] 允许透传未来新增的未知字段。
 */
export interface Message {
  id: string;
  // conversationId 字段在普通消息中不返回，仅在 tips 消息中使用 conversation_id
  conversationId?: string;
  role?: 'user' | 'assistant' | 'system';  // 可选，tips 消息无 role
  content?: string;         // 可选，tips 消息不返回 content
  timestamp: number;        // 秒时间戳（旧 API 格式）
  type?: 'text' | 'media' | 'conversation_tips' | 'app_creation_detected' | string;  // 消息类型
  tips?: string[];          // 用于 type='conversation_tips'
  toolCalls?: ToolCall[];   // 用于包含工具调用的消息
  media?: MessageMedia;     // 媒体资源（图片/音频/视频）
  todos?: TodoItem[];       // 待办事项列表
  attachments?: MessageAttachment[];  // 文件附件
  // 注意：不透传 metadata_json，与 runtime-plugins 行为一致
  // app_creation_detected 类型专用字段
  app_id?: string;
  app_name?: string;
  app_description?: string;

  /** 索引签名：允许透传 content JSON 中的未知字段 */
  [key: string]: unknown;
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
  url_session_token: string | null;  // URL会话令牌，用于子域名预览场景
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

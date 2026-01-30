// ═══════════════════════════════════════
// 主客户端（推荐使用）
// ═══════════════════════════════════════
export { RuntimeClient, createClient } from './client/RuntimeClient.js';
export type { RuntimeClientConfig } from './types/config.types.js';

// ═══════════════════════════════════════
// 核心业务类型
// ═══════════════════════════════════════
export type {
  // 对话相关
  Conversation,
  ListConversationsOptions,
  CreateConversationData,
  UpdateConversationData,
  // 消息相关
  Message,
  ListMessagesOptions,
  // 分页
  PaginationMeta,
  PaginatedResult,
} from './types/index.js';

// ═══════════════════════════════════════
// 错误类型（供错误处理使用）
// ═══════════════════════════════════════
export {
  BaseError,
  NetworkError,
  AuthError,
  TimeoutError,
  ProtocolError,
} from './errors/index.js';

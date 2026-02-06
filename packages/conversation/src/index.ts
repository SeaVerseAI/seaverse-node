// ═══════════════════════════════════════
// 主 API
// ═══════════════════════════════════════
export { initConversationSdk } from './functional-api.js';
export type { ListResult, ConversationsListResult } from './functional-api.js';
export { clearUrlSessionTokenCache } from './session/session-token.js';
export type { ConversationClientConfig } from './types/config.types.js';

// ═══════════════════════════════════════
// 核心业务类型
// ═══════════════════════════════════════
export type {
  // 应用相关
  App,
  // 对话相关
  Conversation,
  ConversationResponse,
  // 消息相关
  Message,
  MessageMedia,
  MessageAttachment,
  TodoItem,
  ToolCall,
} from './types/index.js';

export type { CreateConversationData } from './resources/ConversationsResource.js';
export type { ListAppsOptions } from './resources/AppsResource.js';

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

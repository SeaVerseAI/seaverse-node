// ═══════════════════════════════════════
// 主 API
// ═══════════════════════════════════════
export { initConversationSdk } from './functional-api.js';
export type { ConversationClientConfig } from './types/config.types.js';

// ═══════════════════════════════════════
// 核心业务类型
// ═══════════════════════════════════════
export type {
  // 对话相关
  Conversation,
  ConversationResponse,
  // 消息相关
  Message,
  ToolCall,
} from './types/index.js';

export type { CreateConversationData } from './resources/ConversationsResource.js';

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

// ═══════════════════════════════════════
// 主 API
// ═══════════════════════════════════════
export { initRuntimeSdk } from './functional-api.js';
export type { RuntimeClientConfig } from './types/config.types.js';

// ═══════════════════════════════════════
// 核心业务类型
// ═══════════════════════════════════════
export type {
  // 对话相关
  Conversation,
  // 消息相关
  Message,
  ToolCall,
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

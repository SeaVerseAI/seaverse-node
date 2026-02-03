import type { TokenProvider } from './token.types.js';

/**
 * Conversation SDK 客户端配置
 */
export interface ConversationClientConfig {
  /**
   * 环境（自动映射到对应的服务 URL）
   */
  environment: 'dev' | 'prod';

  /**
   * 访问 token（必需）
   */
  token: string;

  /**
   * Token 提供函数（可选，优先级高于 token）
   */
  getToken?: TokenProvider;

  /**
   * 自定义 fetch 实现
   */
  fetch?: typeof fetch;

  /**
   * 请求超时（毫秒）
   * @default 30000
   */
  timeout?: number;
}

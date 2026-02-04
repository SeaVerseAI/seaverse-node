import { createHttpClient } from '../transport/index.js';
import { DbClient } from '../data/DbClient.js';
import { getUrlSessionToken as getToken } from '../session/session-token.js';
import type { ConversationClientConfig } from '../types/config.types.js';
import { getEnvironmentConfig } from './EnvironmentConfig.js';
import { ConversationsResource } from '../resources/ConversationsResource.js';
import { MessagesResource } from '../resources/MessagesResource.js';
import { AppsResource } from '../resources/AppsResource.js';

/**
 * Conversation SDK 客户端
 */
export class ConversationClient {
  private readonly config: Required<ConversationClientConfig> & {
    urls: ReturnType<typeof getEnvironmentConfig>;
  };
  private readonly db: DbClient;

  // 资源访问器
  public readonly conversations: ConversationsResource;
  public readonly messages: MessagesResource;
  public readonly apps: AppsResource;

  constructor(config: ConversationClientConfig) {
    // 环境配置解析
    const envConfig = getEnvironmentConfig(config.environment);

    this.config = {
      environment: config.environment,
      token: config.token,
      getToken: config.getToken || (() => config.token),
      fetch: config.fetch || globalThis.fetch,
      timeout: config.timeout || 30000,
      urls: envConfig,
    };

    // 创建底层客户端
    const http = createHttpClient({
      baseUrl: this.config.urls.postgrest,
      fetch: this.config.fetch,
      getAuthToken: this.config.getToken,
      timeoutMs: this.config.timeout,
    });

    this.db = new DbClient(http);

    // 初始化资源
    this.conversations = new ConversationsResource(this.db, this.config.getToken, this.config.urls.auth);
    this.messages = new MessagesResource(this.db);
    this.apps = new AppsResource(this.db);
  }

  /**
   * 获取 URL session token
   */
  async getUrlSessionToken(): Promise<string | null> {
    const token = await this.config.getToken();
    if (!token) return null;

    return getToken({
      authBaseUrl: this.config.urls.auth,
      accessToken: token,
      fetch: this.config.fetch,
    });
  }
}

/**
 * 创建 Conversation SDK 客户端（工厂函数）
 */
export function createClient(config: ConversationClientConfig): ConversationClient {
  return new ConversationClient(config);
}

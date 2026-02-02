/**
 * 函数式 API
 * 提供简洁的函数式调用方式
 */

import { createHttpClient } from './transport/index.js';
import { DbClient } from './data/DbClient.js';
import type { RuntimeClientConfig } from './types/config.types.js';
import { getEnvironmentConfig } from './client/EnvironmentConfig.js';
import { listAppsWithConversations } from './aggregated/apps-with-conversations.js';
import type { ListAppsWithConversationsResult, Message } from './types/index.js';
import { MessagesResource } from './resources/MessagesResource.js';

/**
 * 初始化 Runtime SDK
 */
export function initRuntimeSdk(config: RuntimeClientConfig) {
  // 环境配置解析
  const envConfig = getEnvironmentConfig(config.environment);

  const fullConfig = {
    environment: config.environment,
    token: config.token,
    getToken: config.getToken || (() => config.token),
    fetch: config.fetch || globalThis.fetch,
    timeout: config.timeout || 30000,
    urls: envConfig,
  };

  // 创建底层客户端
  const http = createHttpClient({
    baseUrl: fullConfig.urls.postgrest,
    fetch: fullConfig.fetch,
    getAuthToken: fullConfig.getToken,
    timeoutMs: fullConfig.timeout,
  });

  const db = new DbClient(http);
  const messagesResource = new MessagesResource(db);

  /**
   * 获取 Apps 及其会话列表
   * 每个 app 只返回消息最多的那一个会话
   */
  async function getAppsWithConversationsList(options?: {
    appId?: string;
    page?: number;
    pageSize?: number;
  }): Promise<ListAppsWithConversationsResult> {
    return listAppsWithConversations({
      ...options,
      db,
    });
  }

  /**
   * 获取会话的消息列表(旧 API 格式)
   */
  async function getMessagesList(
    conversationId: string,
    options?: {
      page?: number;
      pageSize?: number;
    }
  ): Promise<{ messages: Message[]; hasMore: boolean }> {
    const result = await messagesResource.list(conversationId, options);

    // 转换为旧 API 格式:{messages: [...], hasMore: boolean}
    return {
      messages: result.data,
      hasMore: result.pagination.hasNextPage,
    };
  }

  return {
    getAppsWithConversationsList,
    getMessagesList,
  };
}

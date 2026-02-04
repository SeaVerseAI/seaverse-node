/**
 * 函数式 API
 * 提供简洁的函数式调用方式
 */

import { createHttpClient } from './transport/index.js';
import { DbClient } from './data/DbClient.js';
import type { ConversationClientConfig } from './types/config.types.js';
import { getEnvironmentConfig } from './client/EnvironmentConfig.js';
import { listAppsWithConversations } from './aggregated/apps-with-conversations.js';
import type { ListAppsWithConversationsResult, Message, ConversationResponse, Conversation } from './types/index.js';
import type { PaginatedResult } from './types/pagination.types.js';
import { MessagesResource } from './resources/MessagesResource.js';
import { ConversationsResource, type CreateConversationData, type ListConversationsOptions } from './resources/ConversationsResource.js';

/**
 * 初始化 Conversation SDK
 */
export function initConversationSdk(config: ConversationClientConfig) {
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
  const conversationsResource = new ConversationsResource(db);

  /**
   * 获取会话列表（带分页）
   */
  async function getConversationsList(
    options?: ListConversationsOptions
  ): Promise<PaginatedResult<Conversation>> {
    return conversationsResource.list(options);
  }

  /**
   * 获取 Apps 及其会话列表
   * 每个 app 返回全部会话,按最后更新时间倒序排列
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

  /**
   * 创建会话
   */
  async function createConversation(data: CreateConversationData): Promise<ConversationResponse> {
    return conversationsResource.createWithResponse(data);
  }

  /**
   * 删除会话
   */
  async function deleteConversation(conversationId: string): Promise<void> {
    return conversationsResource.delete(conversationId);
  }

  return {
    getConversationsList,
    getAppsWithConversationsList,
    getMessagesList,
    createConversation,
    deleteConversation,
  };
}

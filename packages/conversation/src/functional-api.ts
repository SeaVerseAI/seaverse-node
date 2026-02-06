/**
 * 函数式 API
 * 提供简洁的函数式调用方式
 */

import { createHttpClient } from './transport/index.js';
import { DbClient } from './data/DbClient.js';
import type { ConversationClientConfig } from './types/config.types.js';
import { getEnvironmentConfig } from './client/EnvironmentConfig.js';
import { listAppsWithConversations } from './aggregated/apps-with-conversations.js';
import { getUrlSessionToken } from './session/session-token.js';
import type { App, ListAppsWithConversationsResult, Message, ConversationResponse, Conversation } from './types/index.js';
import { MessagesResource } from './resources/MessagesResource.js';
import { ConversationsResource, type CreateConversationData, type ListConversationsOptions } from './resources/ConversationsResource.js';
import { AppsResource, type ListAppsOptions } from './resources/AppsResource.js';

/**
 * 列表查询结果（统一返回格式）
 */
export interface ListResult<T> {
  data: T[];
  hasMore: boolean;
}

/**
 * 会话列表查询结果（附带 url_session_token）
 */
export interface ConversationsListResult extends ListResult<Conversation> {
  /** PostgREST url_session_token，通过缓存获取（不会每次都请求 auth 服务） */
  url_session_token: string | null;
}

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
  const conversationsResource = new ConversationsResource(db, fullConfig.getToken, fullConfig.urls.auth);
  const appsResource = new AppsResource(db);

  /**
   * 获取应用列表（带分页）
   *
   * 仅查询 apps 表，不触发 url-session/generate 请求。
   * 当只需要应用列表数据时，使用此方法代替 getAppsWithConversationsList。
   */
  async function getAppsList(
    options?: ListAppsOptions
  ): Promise<ListResult<App>> {
    const result = await appsResource.list(options);
    return {
      data: result.data,
      hasMore: result.pagination.hasNextPage,
    };
  }

  /**
   * 获取会话列表（带分页）
   *
   * 仅查询 conversations 表，不触发 apps 查询。
   * 附带 url_session_token（通过缓存获取，不会每次都请求 auth 服务）。
   */
  async function getConversationsList(
    options?: ListConversationsOptions
  ): Promise<ConversationsListResult> {
    // 并行获取会话列表和 url_session_token（token 有缓存，通常直接返回）
    const [result, urlSessionToken] = await Promise.all([
      conversationsResource.list(options),
      getUrlSessionToken({
        accessToken: (await fullConfig.getToken()) || '',
        authBaseUrl: fullConfig.urls.auth,
      }),
    ]);

    return {
      data: result.data,
      hasMore: result.pagination.hasNextPage,
      url_session_token: urlSessionToken,
    };
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
    // 获取当前token
    const accessToken = await fullConfig.getToken();

    return listAppsWithConversations({
      ...options,
      db,
      accessToken: accessToken || '',
      authBaseUrl: fullConfig.urls.auth,
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
    getAppsList,
    getConversationsList,
    getAppsWithConversationsList,
    getMessagesList,
    createConversation,
    deleteConversation,
  };
}

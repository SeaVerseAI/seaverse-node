import type { DbClient } from '../data/DbClient.js';
import type {
  AppWithConversations,
  Conversation,
  ListAppsWithConversationsResult,
} from '../types/index.js';
import type { DbSchema } from '../types/models.types.js';
import { transformConversation } from '../transforms/conversation.transform.js';
import { transformApp } from '../transforms/app.transform.js';
import { pageToOffset } from '../types/pagination.types.js';
import { getUrlSessionToken } from '../session/session-token.js';

/**
 * Configuration for aggregated query
 */
export interface ListAppsWithConversationsConfig {
  /**
   * Optional app ID to filter by
   */
  appId?: string;

  /**
   * Page number (1-based)
   * @default 1
   */
  page?: number;

  /**
   * Page size
   * @default 20
   */
  pageSize?: number;

  /**
   * Database client
   */
  db: DbClient;

  /**
   * Access token for URL session token generation
   */
  accessToken: string;

  /**
   * Auth service base URL
   * @default "https://auth.seaverse.ai"
   */
  authBaseUrl?: string;
}

/**
 * List apps with their conversations (aggregated query)
 * Returns conversations for each app, sorted by updated_at descending (newest first).
 *
 * 仅查询当前分页内 apps 对应的 conversations，避免全量拉取。
 *
 * Replaces `/api/apps/with-conversations` endpoint
 *
 * @example
 * const result = await listAppsWithConversations({
 *   db: dbClient,
 *   accessToken: 'user-token',
 * });
 */
export async function listAppsWithConversations(
  config: ListAppsWithConversationsConfig
): Promise<ListAppsWithConversationsResult> {
  const {
    appId,
    page = 1,
    pageSize = 20,
    db,
    accessToken,
    authBaseUrl,
  } = config;

  // Calculate pagination params
  const { limit, offset } = pageToOffset(page, pageSize);

  // Step 1: 并行获取 apps 列表和 url_session_token
  const [dbApps, urlSessionToken] = await Promise.all([
    // Get apps with pagination, sorted by created_at descending
    db.get<DbSchema.App>(
      'apps',
      appId
        ? { filter: { app_id: `eq.${appId}` }, order: 'created_at.desc', limit, offset, count: 'exact' }
        : { order: 'created_at.desc', limit, offset, count: 'exact' }
    ),

    // Get URL session token from auth service
    getUrlSessionToken({
      accessToken,
      authBaseUrl,
    }),
  ]);

  // Step 2: 根据分页后的 app IDs 查询对应的 conversations（避免全量拉取）
  const appIds = dbApps.data.map((app) => (app.app_id || app.id) as string);

  let conversationsByAppId = new Map<string, Conversation[]>();

  if (appIds.length > 0) {
    // 每个 app 最多返回 50 条会话，总 limit = appIds 数量 × 50
    // 避免 PostgREST 默认 max-rows (500) 导致全量返回
    const conversationsLimit = Math.max(appIds.length * 50, 100);

    const dbConversations = await db.get<DbSchema.Conversation>(
      'conversations',
      {
        filter: { app_id: `in.(${appIds.join(',')})` },
        order: 'updated_at.desc',
        limit: conversationsLimit,
      }
    );

    // Group conversations by appId
    // Conversations are already sorted by updated_at.desc from database query
    for (const dbConv of dbConversations.data) {
      const conv = transformConversation(dbConv);

      if (conv.appId) {
        if (!conversationsByAppId.has(conv.appId)) {
          conversationsByAppId.set(conv.appId, []);
        }
        conversationsByAppId.get(conv.appId)!.push(conv);
      }
    }
  }

  // Build response (each app has its conversations sorted by updatedAt)
  const appsWithConversations: AppWithConversations[] = dbApps.data.map((dbApp) => {
    const appId = (dbApp.app_id || dbApp.id) as string;
    const conversations = conversationsByAppId.get(appId) || [];
    return {
      app: transformApp(dbApp),
      conversations,
    };
  });

  // Calculate hasMore (是否还有下一页)
  const total = dbApps.count || 0;
  const hasMore = page * pageSize < total;

  return {
    apps: appsWithConversations,
    hasMore,
    url_session_token: urlSessionToken,
  };
}

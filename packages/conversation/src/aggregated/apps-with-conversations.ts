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
   * @default "https://auth.sg.seaverse.dev"
   */
  authBaseUrl?: string;
}

/**
 * List apps with their conversations (aggregated query)
 * Returns ALL conversations for each app, sorted by updated_at descending (newest first).
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

  // Parallel requests to avoid waterfall (including url_session_token)
  const [dbApps, dbConversations, urlSessionToken] = await Promise.all([
    // Get apps with pagination, sorted by created_at descending
    db.get<DbSchema.App>(
      'apps',
      appId
        ? { filter: { app_id: `eq.${appId}` }, order: 'created_at.desc', limit, offset, count: 'exact' }
        : { order: 'created_at.desc', limit, offset, count: 'exact' }
    ),

    // Get conversations (all conversations), sorted by updated_at descending
    db.get<DbSchema.Conversation>(
      'conversations',
      appId
        ? { filter: { app_id: `eq.${appId}` }, order: 'updated_at.desc' }
        : { order: 'updated_at.desc' }
    ),

    // Get URL session token from auth service
    getUrlSessionToken({
      accessToken,
      authBaseUrl,
    }),
  ]);

  // Group conversations by appId and include ALL conversations
  // Conversations are already sorted by updated_at.desc from database query
  const conversationsByAppId = new Map<string, Conversation[]>();

  for (const dbConv of dbConversations.data) {
    // Don't pass urlSessionToken - it will be returned at top level
    const conv = transformConversation(dbConv);

    // Only process conversations with appId (skip global conversations)
    if (conv.appId) {
      if (!conversationsByAppId.has(conv.appId)) {
        conversationsByAppId.set(conv.appId, []);
      }
      conversationsByAppId.get(conv.appId)!.push(conv);
    }
  }

  // Build response (each app has ALL conversations sorted by updatedAt)
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

import type { DbClient } from '../data/DbClient.js';
import type { getUrlSessionToken } from '../session/session-token.js';
import type {
  AppWithConversations,
  Conversation,
  ListAppsWithConversationsResult,
} from '../types/index.js';
import type { DbSchema } from '../types/models.types.js';
import { transformConversation } from '../transforms/conversation.transform.js';
import { transformApp } from '../transforms/app.transform.js';

/**
 * Configuration for aggregated query
 */
export interface ListAppsWithConversationsConfig {
  /**
   * Optional app ID to filter by
   */
  appId?: string;

  /**
   * Database client
   */
  db: DbClient;

  /**
   * Get URL session token function
   */
  getUrlSessionToken: typeof getUrlSessionToken;

  /**
   * Access token for URL session token generation
   */
  accessToken: string;

  /**
   * Auth service base URL
   */
  authBaseUrl?: string;
}

/**
 * List apps with their conversations (aggregated query)
 * Replaces `/api/apps/with-conversations` endpoint
 *
 * @example
 * const result = await listAppsWithConversations({
 *   db: dbClient,
 *   getUrlSessionToken,
 *   accessToken: 'user-token',
 * });
 */
export async function listAppsWithConversations(
  config: ListAppsWithConversationsConfig
): Promise<ListAppsWithConversationsResult> {
  const { appId, db, getUrlSessionToken: getToken, accessToken, authBaseUrl } = config;

  // Parallel requests to avoid waterfall
  const [dbApps, dbConversations, urlSessionToken] = await Promise.all([
    // Get apps
    db.get<DbSchema.App>('apps', appId ? { filter: { app_id: `eq.${appId}` } } : {}),

    // Get conversations
    db.get<DbSchema.Conversation>('conversations', appId ? { filter: { app_id: `eq.${appId}` } } : {}),

    // Get URL session token
    getToken({
      accessToken,
      authBaseUrl,
    }),
  ]);

  // Group conversations by appId (camelCase model)
  const conversationsByAppId = new Map<string, Conversation[]>();
  const globalConversations: Conversation[] = [];

  for (const dbConv of dbConversations.data) {
    const conv = transformConversation(dbConv, urlSessionToken || undefined);
    if (conv.appId) {
      const existing = conversationsByAppId.get(conv.appId) || [];
      existing.push(conv);
      conversationsByAppId.set(conv.appId, existing);
    } else {
      globalConversations.push(conv);
    }
  }

  // Build response
  const appsWithConversations: AppWithConversations[] = dbApps.data.map((dbApp) => ({
    app: transformApp(dbApp),
    conversations: conversationsByAppId.get((dbApp.app_id || dbApp.id) as string) || [],
  }));

  return {
    urlSessionToken,
    apps: appsWithConversations,
    globalConversations,
  };
}

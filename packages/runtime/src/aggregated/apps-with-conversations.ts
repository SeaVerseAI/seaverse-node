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
}

/**
 * List apps with their conversations (aggregated query)
 * Each app returns only ONE conversation - the one with the most messages.
 *
 * Implementation: Real-time message counting
 * - Queries all conversations
 * - Counts messages for each conversation from messages table
 * - Selects the conversation with highest message count per app
 *
 * This ensures accuracy even if message_count field is not maintained.
 *
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
  const {
    appId,
    page = 1,
    pageSize = 20,
    db,
  } = config;

  // Calculate pagination params
  const { limit, offset } = pageToOffset(page, pageSize);

  // Parallel requests to avoid waterfall
  const [dbApps, dbConversations] = await Promise.all([
    // Get apps with pagination
    db.get<DbSchema.App>(
      'apps',
      appId
        ? { filter: { app_id: `eq.${appId}` }, limit, offset, count: 'exact' }
        : { limit, offset, count: 'exact' }
    ),

    // Get conversations (all conversations to find max message_count per app)
    db.get<DbSchema.Conversation>(
      'conversations',
      appId ? { filter: { app_id: `eq.${appId}` } } : {}
    ),
  ]);

  // Extract all conversation IDs for message counting
  const conversationIds = dbConversations.data
    .map((conv) => conv.conversation_id || conv.id)
    .filter(Boolean) as string[];

  // Fetch all messages for these conversations and count them
  let realMessageCounts = new Map<string, number>();

  if (conversationIds.length > 0) {
    // Query all messages for these conversations
    const dbMessages = await db.get<DbSchema.Message>('messages', {
      filter: { conversation_id: `in.(${conversationIds.join(',')})` },
      select: 'conversation_id',
    });

    // Count messages per conversation
    for (const msg of dbMessages.data) {
      const count = realMessageCounts.get(msg.conversation_id) || 0;
      realMessageCounts.set(msg.conversation_id, count + 1);
    }
  }

  // Group conversations by appId and select the one with highest REAL message count
  const topConversationByAppId = new Map<string, Conversation>();

  for (const dbConv of dbConversations.data) {
    const conv = transformConversation(dbConv);
    const convId = dbConv.conversation_id || dbConv.id;

    // Use real message count instead of db field
    const realCount = realMessageCounts.get(convId as string) || 0;

    // Only process conversations with appId (skip global conversations)
    if (conv.appId) {
      const existing = topConversationByAppId.get(conv.appId);
      const existingCount = existing?.messageCount || 0;

      // Only keep the conversation with highest REAL message count
      if (!existing || realCount > existingCount) {
        // Update messageCount with real count
        conv.messageCount = realCount;
        topConversationByAppId.set(conv.appId, conv);
      }
    }
  }

  // Build response (each app has at most 1 conversation - the one with highest message_count)
  const appsWithConversations: AppWithConversations[] = dbApps.data.map((dbApp) => {
    const topConv = topConversationByAppId.get((dbApp.app_id || dbApp.id) as string);
    return {
      app: transformApp(dbApp),
      conversations: topConv ? [topConv] : [],
    };
  });

  // Calculate hasMore (是否还有下一页)
  const total = dbApps.count || 0;
  const hasMore = page * pageSize < total;

  return {
    apps: appsWithConversations,
    hasMore,
  };
}

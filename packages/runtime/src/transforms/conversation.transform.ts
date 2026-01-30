import type { Conversation, DbSchema } from '../types/models.types.js';

/**
 * 秒时间戳转换为毫秒时间戳
 */
function toMilliseconds(seconds: number | undefined): number {
  if (!seconds) return 0;
  // 如果已经是毫秒时间戳（13位），直接返回
  if (seconds > 10000000000) return seconds;
  // 否则转换为毫秒
  return seconds * 1000;
}

/**
 * 转换数据库会话对象为前端模型
 */
export function transformConversation(
  dbConv: DbSchema.Conversation,
  urlSessionToken?: string
): Conversation {
  const id = (dbConv.conversation_id || dbConv.id || '').toString();
  return {
    id,
    title: dbConv.title || 'Untitled',
    appId: dbConv.app_id,
    userId: dbConv.user_id,
    createdAt: toMilliseconds(dbConv.created_at),
    updatedAt: toMilliseconds(dbConv.updated_at),
    lastActiveAt: toMilliseconds(dbConv.last_message_created_at || dbConv.updated_at),
    urlSessionToken,
  };
}

/**
 * 转换前端会话对象为数据库格式（用于创建/更新）
 */
export function toDbConversation(conv: Partial<Conversation>): Partial<DbSchema.Conversation> {
  const result: Partial<DbSchema.Conversation> = {};

  // 兼容：优先写 conversation_id
  if (conv.id) result.conversation_id = conv.id;
  if (conv.title) result.title = conv.title;
  if (conv.appId !== undefined) result.app_id = conv.appId;
  if (conv.userId) result.user_id = conv.userId;

  return result;
}

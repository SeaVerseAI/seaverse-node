import type { Message, DbSchema } from '../types/models.types.js';

/**
 * 秒时间戳转换为毫秒时间戳
 */
function toMilliseconds(seconds: number): number {
  if (seconds > 10000000000) return seconds;
  return seconds * 1000;
}

/**
 * 转换数据库消息对象为前端模型
 */
export function transformMessage(dbMsg: DbSchema.Message): Message {
  return {
    id: dbMsg.id,
    conversationId: dbMsg.conversation_id,
    role: dbMsg.role,
    content: dbMsg.content,
    timestamp: toMilliseconds(dbMsg.created_at),
    metadata: dbMsg.metadata as Record<string, unknown> | undefined,
  };
}

/**
 * 转换前端消息对象为数据库格式
 */
export function toDbMessage(msg: Partial<Message>): Partial<DbSchema.Message> {
  const result: Partial<DbSchema.Message> = {};

  if (msg.id) result.id = msg.id;
  if (msg.conversationId) result.conversation_id = msg.conversationId;
  if (msg.role) result.role = msg.role;
  if (msg.content) result.content = msg.content;
  if (msg.metadata) result.metadata = msg.metadata;

  return result;
}

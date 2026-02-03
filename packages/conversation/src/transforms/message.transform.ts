import type { Message, DbSchema } from '../types/models.types.js';

/**
 * 秒时间戳保持为秒
 * 旧 API 使用秒级时间戳,不转换为毫秒
 */
function toSeconds(seconds: number): number {
  // 如果是毫秒级时间戳,转换为秒
  if (seconds > 10000000000) return Math.floor(seconds / 1000);
  return seconds;
}

/**
 * 转换数据库消息对象为前端模型
 */
export function transformMessage(dbMsg: DbSchema.Message): Message {
  // 获取消息 ID（兼容 message_id 和 id 字段）
  const dbId = dbMsg.message_id || dbMsg.id || '';
  
  // 解析 content 字段（可能是 JSON 字符串）
  let parsedContent: any = null;
  let actualContent = dbMsg.content;
  let actualRole = dbMsg.role;
  let actualId = dbId;

  try {
    // 尝试解析 content 为 JSON（如果它是 JSON 字符串）
    if (typeof dbMsg.content === 'string' && dbMsg.content.trim().startsWith('{')) {
      parsedContent = JSON.parse(dbMsg.content);
      
      // 如果解析成功，使用解析后的内容
      if (parsedContent && typeof parsedContent === 'object') {
        // 优先使用解析后的字段
        if (parsedContent.content !== undefined) {
          actualContent = parsedContent.content;
        }
        if (parsedContent.role !== undefined) {
          actualRole = parsedContent.role;
        }
        if (parsedContent.id !== undefined) {
          actualId = parsedContent.id;
        }
      }
    }
  } catch {
    // 解析失败，使用原始 content
  }

  // 基础字段 - 不包含 conversationId
  const base: Partial<Message> & { id: string; timestamp: number } = {
    id: actualId,
    role: actualRole,
    content: actualContent,
    timestamp: toSeconds(dbMsg.created_at),
  };

  // 解析 metadata 中的扩展字段，或从解析后的 content 中提取
  let meta: any = dbMsg.metadata;

  // 如果 content 被解析了，优先使用解析后的数据
  if (parsedContent) {
    // 提取 type（消息类型）
    if (parsedContent.type) {
      base.type = parsedContent.type;

      // 对于 conversation_tips 类型，添加 conversation_id 字段
      if (parsedContent.type === 'conversation_tips') {
        (base as any).conversation_id = dbMsg.conversation_id;
      }
    }

    // 提取 tips（用于 conversation_tips 类型）
    if (parsedContent.tips && Array.isArray(parsedContent.tips)) {
      base.tips = parsedContent.tips;
      // 确保 tips 消息有 conversation_id
      (base as any).conversation_id = dbMsg.conversation_id;
      // tips 消息不返回 content 字段
      delete base.content;
    }

    // 提取 toolCalls（工具调用信息）
    if (parsedContent.toolCalls && Array.isArray(parsedContent.toolCalls)) {
      base.toolCalls = parsedContent.toolCalls;
    }
  }

  // 如果 metadata 存在，也尝试从中提取字段
  if (meta) {
    // 如果还没有设置 type，从 metadata 中提取
    if (!base.type && meta.type) {
      base.type = meta.type;

      // 对于 conversation_tips 类型，添加 conversation_id 字段
      if (meta.type === 'conversation_tips') {
        (base as any).conversation_id = dbMsg.conversation_id;
      }
    }

    // 如果还没有设置 tips，从 metadata 中提取
    if (!base.tips && meta.tips && Array.isArray(meta.tips)) {
      base.tips = meta.tips;
      // 确保 tips 消息有 conversation_id
      (base as any).conversation_id = dbMsg.conversation_id;
      // tips 消息不返回 content 字段
      delete base.content;
    }

    // 如果还没有设置 toolCalls，从 metadata 中提取
    if (!base.toolCalls && meta.toolCalls && Array.isArray(meta.toolCalls)) {
      base.toolCalls = meta.toolCalls;
    }

    // 不保留 metadata 字段（旧 API 格式）
  }

  return base as Message;
}

/**
 * 转换前端消息对象为数据库格式
 */
export function toDbMessage(msg: Partial<Message> & { metadata?: Record<string, unknown> }): Partial<DbSchema.Message> {
  const result: Partial<DbSchema.Message> = {};

  if (msg.id) result.id = msg.id;
  if (msg.conversationId) result.conversation_id = msg.conversationId;
  if (msg.role) result.role = msg.role;
  if (msg.content) result.content = msg.content;
  if (msg.metadata) result.metadata = msg.metadata;

  return result;
}

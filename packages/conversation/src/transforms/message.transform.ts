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
 *
 * 完全对齐 runtime-plugins/conversations getMessages 的「全量透传」行为：
 *   - content 是合法 JSON 对象 → 直接展开整个 JSON，再用确定性字段覆盖
 *   - content 不是 JSON → 返回 { id, role, content, timestamp } 基础结构
 *
 * 额外增强（SDK 比 runtime-plugins 多做的部分）：
 *   - 透传 metadata_json（数据库列），用于前端 isDuplicateMessage 去重
 *   - 从 metadata（JSONB 列）中补充缺失字段（作为 fallback）
 *   - conversation_tips 类型自动注入 conversation_id
 *
 * @see runtime-plugins/conversations/src/handlers/messages.ts getMessages()
 */
export function transformMessage(dbMsg: DbSchema.Message): Message {
  // 获取消息 ID（兼容 message_id 和 id 字段）
  const dbId = dbMsg.message_id || dbMsg.id || '';

  // ================================================================
  // 1. 尝试将 content 解析为 JSON（对齐 runtime-plugins 行为）
  // ================================================================
  let parsedContent: Record<string, any> | null = null;

  try {
    if (typeof dbMsg.content === 'string' && dbMsg.content.trim().startsWith('{')) {
      const json = JSON.parse(dbMsg.content);
      // 仅在结果是普通对象时使用（与 runtime-plugins 一致：排除数组和原始类型）
      if (json && typeof json === 'object' && !Array.isArray(json)) {
        parsedContent = json;
      }
    }
  } catch {
    // 解析失败，走 fallback 路径
  }

  // ================================================================
  // 2. 构建消息对象
  // ================================================================
  let result: Record<string, any>;

  if (parsedContent) {
    // ── JSON content 路径（全量透传） ──
    // 先展开整个 parsedContent，保留所有字段（含未来新增的未知字段）
    // 再用确定性字段覆盖，确保 id / timestamp 取值正确
    result = {
      ...parsedContent,
      // id: parsedContent 中的 id 优先，否则用 DB 的 message_id/id
      id: parsedContent.id ?? dbId,
      // role: parsedContent 中的 role 优先，否则用 DB 的 role
      role: parsedContent.role ?? dbMsg.role,
      // content: parsedContent 中的 content 优先，否则保持原始 DB content
      // 注意：parsedContent.content 可能为空字符串（合法值），所以用 ?? 而非 ||
      content: parsedContent.content ?? dbMsg.content,
      // timestamp: 始终用 DB 的 created_at（秒级），保持一致
      timestamp: toSeconds(dbMsg.created_at),
    };
  } else {
    // ── Fallback 路径（纯文本 content） ──
    // 与 runtime-plugins 的 catch/fallback 分支完全一致
    result = {
      id: dbId,
      role: dbMsg.role,
      content: dbMsg.content,
      timestamp: toSeconds(dbMsg.created_at),
    };
  }

  // ================================================================
  // 3. 从 metadata（JSONB 列）中补充缺失字段
  //    runtime-plugins 不做这一步，但 SDK 做 fallback 以覆盖更多场景
  // ================================================================
  const meta: any = dbMsg.metadata;
  if (meta && typeof meta === 'object') {
    // 遍历 metadata 的所有字段，仅补充 result 中不存在的
    for (const key of Object.keys(meta)) {
      if (result[key] === undefined || result[key] === null) {
        result[key] = meta[key];
      }
    }
  }

  // ================================================================
  // 4. 特殊类型处理
  // ================================================================

  // conversation_tips 类型：注入 conversation_id，移除 content
  if (result.type === 'conversation_tips') {
    result.conversation_id = dbMsg.conversation_id;
    if (result.tips && Array.isArray(result.tips)) {
      delete result.content;
    }
  }

  // toolCalls / tool_calls 兼容：确保 toolCalls 字段存在
  if (!result.toolCalls && result.tool_calls) {
    result.toolCalls = result.tool_calls;
  }

  // ================================================================
  // 5. 透传 metadata_json（DB 列，用于前端 isDuplicateMessage 去重）
  //    runtime-plugins 不返回此字段，SDK 增强
  // ================================================================
  if (dbMsg.metadata_json !== undefined) {
    result.metadata_json = dbMsg.metadata_json;
  }

  return result as Message;
}

/**
 * 转换前端消息对象为数据库格式
 *
 * 接受任意包含消息字段的对象，从中提取数据库需要的字段
 */
export function toDbMessage(msg: {
  id?: string;
  conversationId?: string;
  role?: string;
  content?: string;
  metadata?: Record<string, unknown>;
}): Partial<DbSchema.Message> {
  const result: Partial<DbSchema.Message> = {};

  if (msg.id) result.id = msg.id;
  if (msg.conversationId) result.conversation_id = msg.conversationId;
  if (msg.role) result.role = msg.role as DbSchema.Message['role'];
  if (msg.content) result.content = msg.content;
  if (msg.metadata) result.metadata = msg.metadata;

  return result;
}

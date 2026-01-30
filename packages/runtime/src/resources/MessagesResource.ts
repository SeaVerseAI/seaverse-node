import type { DbClient } from '../data/DbClient.js';
import type { Message, DbSchema } from '../types/models.types.js';
import type { PaginationOptions, PaginatedResult } from '../types/pagination.types.js';
import { calculatePaginationMeta, pageToOffset } from '../types/pagination.types.js';
import { transformMessage, toDbMessage } from '../transforms/message.transform.js';

/**
 * 消息列表查询选项
 */
export interface ListMessagesOptions extends PaginationOptions {
  // 默认按创建时间倒序排列（最新的在前）
}

/**
 * 创建消息数据
 */
export interface CreateMessageData {
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, unknown>;
}

/**
 * 消息资源类
 */
export class MessagesResource {
  constructor(private readonly db: DbClient) {}

  /**
   * 列出会话的消息（带分页和去重）
   */
  async list(conversationId: string, options: ListMessagesOptions = {}): Promise<PaginatedResult<Message>> {
    // 分页参数
    const page = options.page || 1;
    const pageSize = options.pageSize || 100;
    const { limit, offset } = pageToOffset(page, pageSize);

    const dbMessages = await this.db.get<DbSchema.Message>('messages', {
      filter: { conversation_id: `eq.${conversationId}` },
      order: 'created_at.desc', // 默认倒序，最新的消息在前
      limit,
      offset,
      count: 'exact',
    });

    // 转换消息
    const messages = dbMessages.data.map(transformMessage);

    // 去重（移除重复的媒体消息）
    const dedupedMessages = this.deduplicateMediaMessages(messages);

    // 获取总数（从响应头）
    const total = dbMessages.count || 0;
    const pagination = calculatePaginationMeta(total, page, pageSize);

    return {
      data: dedupedMessages,
      pagination,
    };
  }

  /**
   * 获取单条消息
   */
  async get(messageId: string): Promise<Message | null> {
    const dbMsg = await this.db.getOne<DbSchema.Message>('messages', {
      filter: { id: `eq.${messageId}` },
    });

    if (!dbMsg) return null;

    return transformMessage(dbMsg);
  }

  /**
   * 添加消息
   */
  async create(conversationId: string, data: CreateMessageData): Promise<Message> {
    const dbData = {
      conversation_id: conversationId,
      ...toDbMessage(data),
    };

    const results = await this.db.post<DbSchema.Message>('messages', dbData, {
      returning: 'representation',
    });

    return transformMessage(results[0]);
  }

  /**
   * 更新消息
   */
  async update(messageId: string, data: Partial<CreateMessageData>): Promise<Message> {
    const dbData = toDbMessage(data);

    const results = await this.db.patch<DbSchema.Message>(
      'messages',
      { id: `eq.${messageId}` },
      dbData,
      { returning: 'representation' }
    );

    return transformMessage(results[0]);
  }

  /**
   * 删除消息
   */
  async delete(messageId: string): Promise<void> {
    await this.db.delete('messages', { id: `eq.${messageId}` });
  }

  /**
   * 去重媒体消息
   * 如果两条消息具有相同的 role、content、timestamp 和 media 内容，只保留第一条
   *
   * 参考 runtime-plugins/conversations/src/handlers/messages.ts
   */
  private deduplicateMediaMessages(messages: Message[]): Message[] {
    const result: Message[] = [];
    const seenMedia = new Set<string>();

    for (const msg of messages) {
      // 检查消息的 metadata 中是否包含 media 字段
      const metadata = msg.metadata as any;
      const hasMedia = metadata?.type === 'media' && metadata?.media;

      if (hasMedia) {
        // 创建去重键（基于 content、role、timestamp 和 media）
        const mediaKey = this.createMediaKey(
          msg.content,
          msg.role,
          msg.timestamp,
          metadata.media
        );

        // 如果已经见过这个媒体内容，跳过
        if (seenMedia.has(mediaKey)) {
          continue;
        }

        seenMedia.add(mediaKey);
      }

      result.push(msg);
    }

    return result;
  }

  /**
   * 创建媒体去重键
   * 对数组进行排序以确保 ["a", "b"] 和 ["b", "a"] 被视为相同
   */
  private createMediaKey(
    content: string,
    role: string,
    timestamp: number,
    media: any
  ): string {
    // 排序图片
    const images = (media.images || []).slice().sort();

    // 排序音频
    const audios = (media.audios || []).slice().sort();

    // 排序视频
    const videos = (media.videos || []).slice().sort();

    return `content:${content}|role:${role}|ts:${timestamp}|images:${JSON.stringify(images)}|audios:${JSON.stringify(audios)}|videos:${JSON.stringify(videos)}`;
  }
}

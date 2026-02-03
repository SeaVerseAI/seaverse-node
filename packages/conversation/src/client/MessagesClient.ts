import type { DbClient } from '../data/DbClient.js';
import type { QueryOptions, MutationOptions } from '../data/query.types.js';
import type { Message } from '../types/index.js';

/**
 * Client for message operations
 */
export class MessagesClient {
  constructor(private readonly db: DbClient) {}

  /**
   * List messages for a conversation
   */
  async list(conversationId: string, options?: QueryOptions): Promise<Message[]> {
    const result = await this.db.get<Message>('messages', {
      filter: { conversation_id: `eq.${conversationId}` },
      order: 'created_at.asc',
      ...options,
    });
    return result.data;
  }

  /**
   * Get a single message by ID
   */
  async get(messageId: string): Promise<Message | null> {
    return this.db.getOne<Message>('messages', {
      filter: { id: `eq.${messageId}` },
    });
  }

  /**
   * Add a new message to a conversation
   */
  async add(
    conversationId: string,
    data: Partial<Message>,
    options?: MutationOptions
  ): Promise<Message> {
    const results = await this.db.post<Message>(
      'messages',
      {
        conversation_id: conversationId,
        ...data,
      },
      {
        returning: 'representation',
        ...options,
      }
    );
    return results[0];
  }

  /**
   * Update a message
   */
  async update(
    messageId: string,
    data: Partial<Message>,
    options?: MutationOptions
  ): Promise<Message> {
    const results = await this.db.patch<Message>(
      'messages',
      { id: `eq.${messageId}` },
      data,
      {
        returning: 'representation',
        ...options,
      }
    );
    return results[0];
  }

  /**
   * Delete a message
   */
  async delete(messageId: string): Promise<void> {
    await this.db.delete('messages', { id: `eq.${messageId}` });
  }
}

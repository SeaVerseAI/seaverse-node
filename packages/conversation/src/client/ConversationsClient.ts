import type { DbClient } from '../data/DbClient.js';
import type { QueryOptions, MutationOptions } from '../data/query.types.js';
import type { Conversation } from '../types/index.js';

/**
 * Client for conversation operations
 */
export class ConversationsClient {
  constructor(private readonly db: DbClient) {}

  /**
   * List conversations
   */
  async list(options?: QueryOptions): Promise<Conversation[]> {
    const result = await this.db.get<Conversation>('conversations', options);
    return result.data;
  }

  /**
   * Get a single conversation by ID
   */
  async get(id: string): Promise<Conversation | null> {
    return this.db.getOne<Conversation>('conversations', {
      filter: { id: `eq.${id}` },
    });
  }

  /**
   * Create a new conversation
   */
  async create(
    data: Partial<Conversation>,
    options?: MutationOptions
  ): Promise<Conversation> {
    const results = await this.db.post<Conversation>('conversations', data, {
      returning: 'representation',
      ...options,
    });
    return results[0];
  }

  /**
   * Update a conversation
   */
  async update(
    id: string,
    data: Partial<Conversation>,
    options?: MutationOptions
  ): Promise<Conversation> {
    const results = await this.db.patch<Conversation>(
      'conversations',
      { id: `eq.${id}` },
      data,
      {
        returning: 'representation',
        ...options,
      }
    );
    return results[0];
  }

  /**
   * Delete a conversation
   */
  async delete(id: string): Promise<void> {
    await this.db.delete('conversations', { id: `eq.${id}` });
  }
}

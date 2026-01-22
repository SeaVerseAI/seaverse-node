/**
 * Protocol parser - converts raw server messages to normalized messages
 *
 * @internal SDK internal use
 */

import type { Message, AssistantMessage } from '../types';
import type {
  ServerMessage,
  AssistantMessageProtocol as RawAssistantMessage,
  MediaResultMessage,
  ResultMessage,
} from './protocol';

/**
 * Protocol normalizer
 */
export class ProtocolNormalizer {
  /**
   * Parse server message
   */
  static normalize(
    serverMsg: ServerMessage,
    conversationId: string
  ): Message[] {
    switch (serverMsg.type) {
      case 'assistant':
        return this.normalizeAssistantMessage(serverMsg, conversationId);

      case 'media_result':
        return this.normalizeMediaMessage(serverMsg, conversationId);

      case 'result':
        return this.normalizeResultMessage(serverMsg, conversationId);

      case 'system':
        // System message (session metadata), does not produce user-visible message
        console.log('[SeaLink] System message received:', {
          subtype: serverMsg.subtype,
          session_id: serverMsg.session_id,
          model: serverMsg.model,
          tools: serverMsg.tools?.length,
          agents: serverMsg.agents?.length,
        });
        return [];

      case 'error':
        throw new Error(serverMsg.error);

      case 'session_initialized':
        // Session initialized successfully, no message produced
        return [];

      default:
        console.warn('[SeaLink] Unknown server message type:', serverMsg);
        return [];
    }
  }

  /**
   * Parse assistant message (handles complex nested structure)
   */
  private static normalizeAssistantMessage(
    msg: RawAssistantMessage,
    conversationId: string
  ): Message[] {
    const messages: AssistantMessage[] = [];

    // Check if content exists and is an array
    if (!msg.content || !Array.isArray(msg.content)) {
      console.log('[SeaLink] Assistant message has no content array, might be tool_use or thinking only');
      // If no content, return empty message list (not an error, just no text content)
      return messages;
    }

    // Extract all text blocks
    const textBlocks = msg.content.filter((block) => block.type === 'text');

    // Extract thinking blocks (optional)
    const thinkingBlocks = msg.content.filter((block) => block.type === 'thinking');

    if (textBlocks.length > 0) {
      // Merge all text blocks
      const content = textBlocks
        .map((block) => ('text' in block ? block.text : ''))
        .join('\n');

      messages.push({
        id: this.generateId(),
        conversationId,
        role: 'assistant',
        content,
        createdAt: Date.now(),
      });
    } else if (thinkingBlocks.length > 0) {
      // If only thinking blocks, can also return as message (optional)
      console.log('[SeaLink] Message only contains thinking blocks, skipping');
    } else {
      // Might be tool calls or other types of content
      console.log('[SeaLink] Message contains non-text content:', msg.content.map(b => b.type));
    }

    // Check if there are media-related tool calls
    // (Simplified handling here, actual implementation may need more complex logic)

    return messages;
  }

  /**
   * Parse media message
   */
  private static normalizeMediaMessage(
    msg: MediaResultMessage,
    conversationId: string
  ): Message[] {
    return [
      {
        id: this.generateId(),
        conversationId,
        role: 'assistant',
        content: 'Generated media file',
        createdAt: Date.now(),
        raw: {
          media: msg.media,
        },
      },
    ];
  }

  /**
   * Parse result message (non-streaming response)
   */
  private static normalizeResultMessage(
    msg: ResultMessage,
    conversationId: string
  ): Message[] {
    // If error result, throw exception
    if (msg.subtype === 'error' || msg.is_error) {
      throw new Error(msg.result || 'Unknown error');
    }

    // Return assistant message
    return [
      {
        id: this.generateId(),
        conversationId,
        role: 'assistant',
        content: msg.result,
        createdAt: Date.now(),
        raw: {
          usage: msg.usage,
          modelUsage: msg.modelUsage,
          total_cost_usd: msg.total_cost_usd,
          duration_ms: msg.duration_ms,
        },
      },
    ];
  }

  /**
   * Generate message ID
   */
  private static generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}

/**
 * Stream message buffer
 */
export class StreamBuffer {
  private buffer: Map<string, string> = new Map();

  /**
   * Start new stream message
   */
  start(conversationId: string): void {
    const key = this.getKey(conversationId);
    this.buffer.set(key, '');
  }

  /**
   * Add incremental content
   */
  append(conversationId: string, chunk: string): string {
    const key = this.getKey(conversationId);
    const current = this.buffer.get(key) || '';
    const updated = current + chunk;
    this.buffer.set(key, updated);
    return updated;
  }

  /**
   * Get complete content and clear buffer
   */
  complete(conversationId: string): string {
    const key = this.getKey(conversationId);
    const content = this.buffer.get(key) || '';
    this.buffer.delete(key);
    return content;
  }

  /**
   * Get current content (without clearing)
   */
  get(conversationId: string): string {
    const key = this.getKey(conversationId);
    return this.buffer.get(key) || '';
  }

  private getKey(conversationId: string): string {
    return `${conversationId}_streaming`;
  }
}

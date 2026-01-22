/**
 * React Hook for SeaLink SDK
 *
 * @example
 * ```tsx
 * import { useChat } from '@sealink/chat/react';
 *
 * function ChatComponent() {
 *   const { messages, streamingContent, sendMessage } = useChat({
 *     apiURL: 'https://api.example.com',
 *     conversationId: 'your-conversation-id',
 *     appId: 'your-app-id',
 *     token: 'your-token'
 *   });
 *
 *   return (
 *     <div>
 *       {messages.map(m => <div key={m.id}>{m.content}</div>)}
 *       {streamingContent && <div>{streamingContent}</div>}
 *       <button onClick={() => sendMessage('Hi')}>Send</button>
 *     </div>
 *   );
 * }
 * ```
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Message, ChatConfig, UserMessage } from './types';
import { createChat } from './index';

/**
 * useChat Hook configuration
 */
export interface UseChatConfig extends ChatConfig {
  /** Last message created timestamp */
  lastMessageCreatedAt?: number;
}

/**
 * useChat Hook return value
 */
export interface UseChatReturn {
  /** Message list */
  messages: Message[];
  /** Streaming content (real-time) */
  streamingContent: string;
  /** Send message */
  sendMessage: (content: string) => Promise<UserMessage>;
  /** Interrupt execution */
  interrupt: () => Promise<void>;
  /** Connection status */
  connected: boolean;
}

/**
 * React Hook - supports streaming messages
 *
 * @param config - Hook configuration
 * @returns Hook return value
 *
 * @example
 * ```tsx
 * const { messages, streamingContent, sendMessage } = useChat({
 *   apiURL: 'https://api.example.com',
 *   conversationId: 'your-conversation-id',
 *   appId: 'your-app-id',
 *   token: 'your-token'
 * });
 * ```
 */
export function useChat(config: UseChatConfig): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [connected, setConnected] = useState(false);

  // Create client instance (create only once)
  const client = useMemo(() => createChat(config), [config.apiURL, config.wsURL]);

  // Connect WebSocket
  useEffect(() => {
    let mounted = true;

    async function connect() {
      try {
        await client.connect({
          sessionConfig: config.sessionConfig,
          lastMessageCreatedAt: config.lastMessageCreatedAt,
        });
        if (mounted) {
          setConnected(true);
        }
      } catch (error) {
        console.error('[useChat] Connect failed:', error);
        if (mounted) {
          setConnected(false);
        }
      }
    }

    connect();

    return () => {
      mounted = false;
      client.disconnect();
      setConnected(false);
    };
  }, [client, config.sessionConfig, config.lastMessageCreatedAt]);

  // Listen for new messages (with stream callbacks)
  useEffect(() => {
    const unsubscribe = client.onMessage(
      (msg) => {
        // Add complete message to list
        setMessages((prev) => [...prev, msg]);
      },
      {
        // Stream incremental update
        onChunk: (chunk) => {
          setStreamingContent((prev) => prev + chunk);
        },
        // Stream complete, clear buffer
        onComplete: () => {
          setStreamingContent('');
        },
        // Stream error
        onError: (error) => {
          console.error('[useChat] Stream error:', error);
          setStreamingContent('');
        },
      }
    );

    return unsubscribe;
  }, [client]);

  // Send message
  const sendMessage = useCallback(
    async (content: string) => {
      const userMsg = await client.sendMessage(content);
      setMessages((prev) => [...prev, userMsg]);
      return userMsg;
    },
    [client]
  );

  // Interrupt execution
  const interrupt = useCallback(async () => {
    await client.interrupt();
  }, [client]);

  return {
    messages,
    streamingContent,
    sendMessage,
    interrupt,
    connected,
  };
}

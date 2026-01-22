/**
 * SeaLink SDK - Core API
 *
 * @example Basic usage
 * ```ts
 * import { createChat } from '@sealink/chat';
 *
 * const chat = createChat({
 *   apiURL: 'https://api.example.com',
 *   conversationId: 'your-conversation-id',
 *   appId: 'your-app-id',
 *   token: 'your-token'
 * });
 *
 * await chat.connect();
 * chat.onMessage((msg) => console.log(msg.content));
 * await chat.sendMessage('Hello!');
 * ```
 */

// Export public types
export * from './types';
export * from './errors';

import type {
  ChatConfig,
  UserMessage,
  MessageCallback,
  StreamCallbacks,
  Unsubscribe,
  SessionConfig,
} from './types';
import { WebSocketTransport } from './internal/transport';

/**
 * Connection options
 */
export interface ConnectOptions {
  /** Session configuration */
  sessionConfig?: SessionConfig;
  /** Last message created timestamp */
  lastMessageCreatedAt?: number;
}

/**
 * Chat client interface
 */
export interface ChatClient {
  /**
   * Connect WebSocket
   */
  connect(options?: ConnectOptions): Promise<void>;

  /**
   * Send message
   */
  sendMessage(content: string): Promise<UserMessage>;

  /**
   * Listen for new messages
   */
  onMessage(
    callback: MessageCallback,
    streamCallbacks?: StreamCallbacks
  ): Unsubscribe;

  /**
   * Interrupt current execution
   */
  interrupt(): Promise<void>;

  /**
   * Disconnect
   */
  disconnect(): Promise<void>;

  /**
   * Check connection status
   */
  isConnected(): boolean;
}

/**
 * Build WebSocket URL
 * @internal
 */
function buildWebSocketURL(config: ChatConfig): string {
  // If complete wsURL is provided, use it directly
  if (config.wsURL) {
    return config.wsURL;
  }

  // Build using baseURL + token
  const baseURL = config.baseURL || 'https://sandbox.sg.seaverse.ai/';
  const normalizedBase = baseURL.endsWith('/') ? baseURL : `${baseURL}/`;

  // Convert http:// or https:// to ws:// or wss://
  const wsBase = normalizedBase
    .replace(/^http:\/\//, 'ws://')
    .replace(/^https:\/\//, 'wss://');

  return `${wsBase}ws?token=${config.token}`;
}

/**
 * Create chat client
 *
 * @param config - SDK configuration
 * @returns Chat client instance
 *
 * @example Basic usage
 * ```ts
 * const chat = createChat({
 *   apiURL: 'https://api.example.com',
 *   conversationId: 'your-conversation-id',
 *   appId: 'your-app-id',
 *   token: 'your-auth-token'
 * });
 * ```
 *
 * @example Using custom baseURL
 * ```ts
 * const chat = createChat({
 *   apiURL: 'https://api.example.com',
 *   baseURL: 'https://custom.example.com',
 *   conversationId: 'your-conversation-id',
 *   appId: 'your-app-id',
 *   token: 'your-auth-token'
 * });
 * ```
 *
 * @example Using complete wsURL (backwards compatible)
 * ```ts
 * const chat = createChat({
 *   apiURL: 'https://api.example.com',
 *   wsURL: 'wss://api.example.com/ws?token=xxx',
 *   conversationId: 'your-conversation-id',
 *   appId: 'your-app-id',
 *   token: 'your-auth-token' // wsURL takes priority, this parameter is ignored
 * });
 * ```
 */
export function createChat(config: ChatConfig): ChatClient {
  const wsURL = buildWebSocketURL(config);

  const transport = new WebSocketTransport(
    wsURL,
    config.timeout,
    config.sessionConfig,
    config.retry
  );

  return {
    /**
     * Connect WebSocket
     *
     * @param options - Connection options (optional)
     *
     * @example Basic connection
     * ```ts
     * await chat.connect();
     * ```
     *
     * @example Connect with configuration
     * ```ts
     * await chat.connect({
     *   sessionConfig: {
     *     model: 'claude-opus-4',
     *     max_turns: 200
     *   },
     *   lastMessageCreatedAt: Date.now()
     * });
     * ```
     */
    async connect(options?: ConnectOptions): Promise<void> {
      await transport.connect(
        config.conversationId,
        config.appId,
        options?.sessionConfig,
        options?.lastMessageCreatedAt
      );
    },

    /**
     * Send message
     *
     * @param content - Message content (plain text)
     * @returns Sent user message
     *
     * @example
     * ```ts
     * const userMsg = await chat.sendMessage('Hello!');
     * console.log(userMsg.content); // 'Hello!'
     * ```
     */
    async sendMessage(content: string): Promise<UserMessage> {
      // Send message
      transport.sendUserMessage(config.conversationId, content);

      // Immediately return user message
      const userMessage: UserMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        conversationId: config.conversationId,
        role: 'user',
        content,
        createdAt: Date.now(),
      };

      return userMessage;
    },

    /**
     * Listen for new messages (supports stream callbacks)
     *
     * ## Callback description
     *
     * ### Main callback (callback)
     * - **Purpose**: Receive complete message (called for both streaming and non-streaming)
     * - **Timing**: After message is completely received
     * - **Responsibility**: Add message to message list, persist storage
     *
     * ### Stream callbacks (streamCallbacks)
     * - **onChunk**: Real-time receive incremental content, used for typewriter effect
     * - **onComplete**: Stream end signal, used to clean up streaming UI
     * - **onError**: Streaming error
     *
     * ## Call sequence
     *
     * **Streaming message**:
     * ```
     * onChunk → onChunk → ... → onComplete → callback(complete message)
     * ```
     *
     * **Non-streaming message**:
     * ```
     * callback(complete message)
     * ```
     *
     * @param callback - Main callback function, receives complete message (only callback receiving message content)
     * @param streamCallbacks - Stream message callbacks (optional)
     * @returns Unsubscribe function
     *
     * @example Basic usage (not concerned with streaming)
     * ```ts
     * chat.onMessage((msg) => {
     *   // Add to message list
     *   messageList.push(msg);
     *   console.log('Received message:', msg.content);
     * });
     * ```
     *
     * @example Streaming message (real-time display - recommended)
     * ```ts
     * let streamingDiv: HTMLElement | null = null;
     *
     * chat.onMessage(
     *   // Main callback: handle complete message
     *   (msg) => {
     *     messageList.push(msg);           // Add to list
     *     renderCompleteMessage(msg);      // Render final message
     *   },
     *   // Stream callbacks: only for real-time UI
     *   {
     *     onChunk: (chunk) => {
     *       // Create streaming element (first time)
     *       if (!streamingDiv) {
     *         streamingDiv = document.createElement('div');
     *         streamingDiv.className = 'message streaming';
     *         container.appendChild(streamingDiv);
     *       }
     *       // Append incremental content
     *       streamingDiv.textContent += chunk;
     *     },
     *     onComplete: () => {
     *       // Clean up streaming state
     *       streamingDiv = null;
     *     },
     *     onError: (error) => {
     *       console.error('Stream error:', error);
     *       if (streamingDiv) {
     *         streamingDiv.textContent = 'Send failed';
     *       }
     *     }
     *   }
     * );
     * ```
     */
    onMessage(
      callback: MessageCallback,
      streamCallbacks?: StreamCallbacks
    ): Unsubscribe {
      // transport.onMessage now returns correct unsubscribe function
      return transport.onMessage(callback, streamCallbacks);
    },

    /**
     * Interrupt current execution
     *
     * @example
     * ```ts
     * await chat.interrupt();
     * ```
     */
    async interrupt(): Promise<void> {
      transport.interrupt();
    },

    /**
     * Disconnect
     *
     * @example
     * ```ts
     * await chat.disconnect();
     * ```
     */
    async disconnect(): Promise<void> {
      transport.disconnect();
    },

    /**
     * Check connection status
     *
     * @example
     * ```ts
     * if (chat.isConnected()) {
     *   console.log('Connected');
     * }
     * ```
     */
    isConnected(): boolean {
      return transport.isConnected();
    },
  };
}

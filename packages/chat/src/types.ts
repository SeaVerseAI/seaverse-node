/**
 * SeaLink SDK - Core type definitions
 *
 * @module types
 */

// ==========================================
// Public types (User interface)
// ==========================================

/**
 * Base message interface
 */
export interface BaseMessage {
  /** Message ID */
  id: string;

  /** Conversation ID */
  conversationId: string;

  /** Message content (plain text) */
  content: string;

  /** Created timestamp */
  createdAt: number;

  /** Raw data (for debugging, includes media extensions) */
  raw?: {
    media?: {
      images?: string[];
      videos?: string[];
      audios?: string[];
    };
  };
}

/**
 * User message (returned by sendMessage)
 */
export interface UserMessage extends BaseMessage {
  role: 'user';
}

/**
 * Token usage statistics
 */
export interface Usage {
  /** Input tokens */
  input_tokens: number;
  /** Output tokens */
  output_tokens: number;
  /** Cache creation tokens */
  cache_creation_input_tokens?: number;
  /** Cache read tokens */
  cache_read_input_tokens?: number;
}

/**
 * Stop reason
 */
export type StopReason =
  | 'end_turn'          // Normal end
  | 'max_tokens'        // Max tokens reached
  | 'stop_sequence'     // Stop sequence encountered
  | 'tool_use'          // Tool call required
  | null;               // Unknown or incomplete

/**
 * Assistant message (received by onMessage)
 */
export interface AssistantMessage extends BaseMessage {
  role: 'assistant';

  /**
   * Token usage statistics
   */
  usage?: Usage;

  /**
   * Stop reason
   */
  stopReason?: StopReason;

  /**
   * Model name
   */
  model?: string;

  /**
   * Raw data (extended fields)
   */
  raw?: {
    media?: {
      images?: string[];
      videos?: string[];
      audios?: string[];
    };
    modelUsage?: Record<string, any>;
    total_cost_usd?: number;
    duration_ms?: number;
    [key: string]: any;
  };
}

/**
 * Message union type (for message lists)
 */
export type Message = UserMessage | AssistantMessage;

/**
 * Session configuration
 */
export interface SessionConfig {
  /**
   * AI model name
   * @default "claude-sonnet-4"
   */
  model?: string;

  /**
   * Maximum conversation turns
   * @default 100
   */
  max_turns?: number;
}

/**
 * SDK configuration
 */
export interface ChatConfig {
  /** API base URL (required) */
  apiURL: string;

  /**
   * WebSocket base URL (optional)
   * @default "https://sandbox.sg.seaverse.ai/"
   */
  baseURL?: string;

  /**
   * WebSocket authentication token (required)
   */
  token: string;

  /**
   * Full WebSocket URL (optional, takes priority over baseURL)
   * If provided, baseURL and token will be ignored
   */
  wsURL?: string;

  /**
   * Conversation ID (required)
   */
  conversationId: string;

  /**
   * Application ID (required)
   */
  appId: string;

  /**
   * Request timeout (milliseconds)
   * @default 30000
   */
  timeout?: number;

  /**
   * Session configuration
   */
  sessionConfig?: SessionConfig;

  /**
   * Auto-retry configuration
   */
  retry?: RetryConfig;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  /**
   * Maximum retry attempts
   * @default 2
   */
  maxRetries?: number;

  /**
   * Initial retry delay (milliseconds)
   * @default 1000
   */
  initialDelay?: number;

  /**
   * Maximum retry delay (milliseconds)
   * @default 60000
   */
  maxDelay?: number;

  /**
   * Backoff multiplier
   * @default 2
   */
  backoffMultiplier?: number;
}

/**
 * Send message options
 */
export interface SendMessageOptions {
  /**
   * Attachment list (future extension, not implemented in current version)
   * @future
   */
  attachments?: Attachment[];
}

/**
 * Attachment type (future extension)
 * @future
 */
export interface Attachment {
  type: 'image' | 'file' | 'audio';
  url: string;
  filename: string;
  size?: number;
}

/**
 * Message callback function type
 */
export type MessageCallback = (message: Message) => void;

/**
 * Unsubscribe function type
 */
export type Unsubscribe = () => void;

/**
 * System message data
 */
export interface SystemInfo {
  sessionId: string;
  model?: string;
  version?: string;
  agents?: string[];
  tools?: string[];
  skills?: string[];
}

/**
 * Stream message callbacks
 *
 * ## Call sequence
 *
 * **Streaming message**:
 * ```
 * onChunk(delta1) → onChunk(delta2) → ... → onComplete() → mainCallback(full message)
 * ```
 *
 * **Non-streaming message**:
 * ```
 * mainCallback(full message)
 * ```
 *
 * ## Responsibility division
 *
 * - **onChunk**: Real-time display of incremental content (typewriter effect)
 * - **onComplete**: Stream end signal, used to clean up streaming UI state
 * - **mainCallback**: Only callback receiving complete message, used for persistence to message list
 *
 * @example
 * ```ts
 * let streamingDiv: HTMLElement | null = null;
 *
 * chat.onMessage(
 *   // Main callback: receives complete message (called for both streaming and non-streaming)
 *   (msg) => {
 *     messageList.push(msg);  // Add to message list
 *     renderMessage(msg);     // Render complete message
 *   },
 *   // Stream callbacks: only for real-time UI updates
 *   {
 *     onChunk: (chunk) => {
 *       if (!streamingDiv) {
 *         streamingDiv = createStreamingElement();
 *       }
 *       streamingDiv.textContent += chunk;  // Real-time display
 *     },
 *     onComplete: () => {
 *       streamingDiv = null;  // Clean up streaming state
 *     }
 *   }
 * );
 * ```
 */
export interface StreamCallbacks {
  /**
   * Stream content incremental update
   *
   * Called each time a new text fragment is received, used to implement typewriter effect.
   *
   * @param chunk - New text content (each increment)
   */
  onChunk?: (chunk: string) => void;

  /**
   * Stream message completion event
   *
   * Called when streaming ends, used to clean up streaming UI state.
   * Note: This callback does not pass message content, complete message is received in main callback.
   *
   * @example
   * ```ts
   * onComplete: () => {
   *   // Clean up streaming UI state
   *   streamingIndicator.remove();
   *   isStreaming = false;
   * }
   * ```
   */
  onComplete?: () => void;

  /**
   * Stream message error
   *
   * @param error - Error object
   */
  onError?: (error: Error) => void;

  /**
   * System message callback (optional)
   *
   * Receives session metadata such as available tools, model configuration, etc.
   *
   * @param systemInfo - System information
   */
  onSystem?: (systemInfo: SystemInfo) => void;
}

// ==========================================
// Type guards
// ==========================================

/**
 * Check if message is user message
 */
export function isUserMessage(msg: Message): msg is UserMessage {
  return msg.role === 'user';
}

/**
 * Check if message is assistant message
 */
export function isAssistantMessage(msg: Message): msg is AssistantMessage {
  return msg.role === 'assistant';
}

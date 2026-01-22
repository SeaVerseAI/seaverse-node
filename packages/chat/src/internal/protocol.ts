/**
 * WebSocket protocol definitions
 *
 * Based on runtime-allinone server protocol
 * @internal SDK internal use
 */

// ==========================================
// Client → Server messages
// ==========================================

/**
 * Client message types
 */
export type ClientMessage =
  | InitSessionMessage
  | UserMessageProtocol
  | InterruptMessage
  | HeartbeatMessage;

/**
 * Session configuration
 */
export interface SessionConfig {
  /** AI model name */
  model: string;
  /** Maximum conversation turns */
  max_turns: number;
}

/**
 * Initialize session
 */
export interface InitSessionMessage {
  type: 'init_session';
  conversation_id: string;
  app_id: string;
  config: SessionConfig;
  last_message_created_at?: number;
}

/**
 * User message (protocol layer)
 */
export interface UserMessageProtocol {
  type: 'user';
  conversation_id: string;
  message: {
    content: string;
    attachments?: AttachmentData[];
  };
}

/**
 * Attachment data
 */
export interface AttachmentData {
  attachment_type: 'image' | 'file' | 'audio';
  file_id: string;
  filename: string;
  mime_type: string;
  size?: number;
}

/**
 * Interrupt message
 */
export interface InterruptMessage {
  type: 'interrupt';
}

/**
 * Heartbeat
 */
export interface HeartbeatMessage {
  type: 'heartbeat';
}

// ==========================================
// Server → Client messages
// ==========================================

/**
 * Server message types
 */
export type ServerMessage =
  | SessionInitializedMessage
  | ErrorMessage
  | MediaResultMessage
  | AssistantMessageProtocol
  | StreamEventMessage
  | ResultMessage
  | SystemMessage;

/**
 * Session initialized successfully
 */
export interface SessionInitializedMessage {
  type: 'session_initialized';
  conversation_id: string;
  backend?: string;
  app_id?: string;
  is_processing?: boolean;
}

/**
 * Error message
 */
export interface ErrorMessage {
  type: 'error';
  error: string;
  code?: string;
  details?: Record<string, unknown>;
}

/**
 * Media result
 */
export interface MediaResultMessage {
  type: 'media_result';
  tool_use_id: string;
  media: {
    images: string[];
    videos: string[];
    audios: string[];
  };
  conversation_id?: string;
}

/**
 * Assistant message (protocol layer - complex nested structure)
 */
export interface AssistantMessageProtocol {
  type: 'assistant';
  content: ContentBlock[];
}

/**
 * Content block (nested structure)
 */
export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: string };

/**
 * Stream event content block
 */
export interface StreamEventBlock {
  type: 'content_block_start' | 'content_block_delta' | 'content_block_stop';
  index?: number;
  delta?: {
    type: 'text_delta' | 'thinking_delta';
    text?: string;
    thinking?: string;
  };
  content_block?: {
    type: string;
    text?: string;
  };
}

/**
 * Stream event
 */
export interface StreamEventMessage {
  type: 'stream_event';
  event: StreamEventBlock;
  session_id?: string;
  uuid?: string;
  created_at?: number;
  parent_tool_use_id?: string | null;
}

/**
 * Result message (non-streaming response)
 */
export interface ResultMessage {
  type: 'result';
  subtype: 'success' | 'error';
  result: string;
  session_id: string;
  uuid: string;
  num_turns?: number;
  duration_ms?: number;
  duration_api_ms?: number;
  is_error?: boolean;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
    [key: string]: any;
  };
  modelUsage?: Record<string, any>;
  total_cost_usd?: number;
  permission_denials?: any[];
}

/**
 * System message (session metadata)
 */
export interface SystemMessage {
  type: 'system';
  subtype: 'init' | 'update';
  session_id: string;
  uuid: string;
  model?: string;
  seaverse_version?: string;
  cwd?: string;
  apiKeySource?: string;
  permissionMode?: string;
  output_style?: string;
  agents?: string[];
  tools?: string[];
  skills?: string[];
  slash_commands?: string[];
  plugins?: any[];
  mcp_servers?: any[];
  [key: string]: any;
}

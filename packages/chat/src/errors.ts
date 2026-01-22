/**
 * SDK error type definitions
 *
 * References Anthropic SDK's error hierarchy design
 */

/**
 * SDK base error class
 */
export class ChatError extends Error {
  /** Error code */
  code: string;

  /** Details */
  details?: Record<string, unknown>;

  constructor(message: string, code: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ChatError';
    this.code = code;
    this.details = details;

    // Maintain correct prototype chain
    Object.setPrototypeOf(this, ChatError.prototype);
  }
}

/**
 * Connection error
 *
 * Thrown when WebSocket connection fails or disconnects
 */
export class ConnectionError extends ChatError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CONNECTION_ERROR', details);
    this.name = 'ConnectionError';
    Object.setPrototypeOf(this, ConnectionError.prototype);
  }
}

/**
 * Connection timeout error
 */
export class ConnectionTimeoutError extends ConnectionError {
  constructor(timeout: number) {
    super(
      `Connection timeout after ${timeout}ms`,
      { timeout }
    );
    this.name = 'ConnectionTimeoutError';
    this.code = 'CONNECTION_TIMEOUT';
    Object.setPrototypeOf(this, ConnectionTimeoutError.prototype);
  }
}

/**
 * Message parse error
 *
 * Thrown when server returns invalid message format
 */
export class ParseError extends ChatError {
  /** Raw data */
  rawData?: string;

  constructor(message: string, rawData?: string) {
    super(message, 'PARSE_ERROR', { rawData });
    this.name = 'ParseError';
    this.rawData = rawData;
    Object.setPrototypeOf(this, ParseError.prototype);
  }
}

/**
 * Stream error
 *
 * Error during stream message processing
 */
export class StreamError extends ChatError {
  /** Conversation ID */
  conversationId?: string;

  constructor(message: string, conversationId?: string, details?: Record<string, unknown>) {
    super(message, 'STREAM_ERROR', { conversationId, ...details });
    this.name = 'StreamError';
    this.conversationId = conversationId;
    Object.setPrototypeOf(this, StreamError.prototype);
  }
}

/**
 * API error
 *
 * Error response returned by server
 */
export class APIError extends ChatError {
  /** HTTP status code (if applicable) */
  status?: number;

  constructor(message: string, code: string, status?: number, details?: Record<string, unknown>) {
    super(message, code, details);
    this.name = 'APIError';
    this.status = status;
    Object.setPrototypeOf(this, APIError.prototype);
  }
}

/**
 * Session error
 *
 * Session initialization or management related error
 */
export class SessionError extends ChatError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'SESSION_ERROR', details);
    this.name = 'SessionError';
    Object.setPrototypeOf(this, SessionError.prototype);
  }
}

/**
 * Tool execution error
 *
 * Tool call execution failed
 */
export class ToolExecutionError extends ChatError {
  /** Tool name */
  toolName?: string;

  /** Tool ID */
  toolId?: string;

  constructor(message: string, toolName?: string, toolId?: string, details?: Record<string, unknown>) {
    super(message, 'TOOL_EXECUTION_ERROR', { toolName, toolId, ...details });
    this.name = 'ToolExecutionError';
    this.toolName = toolName;
    this.toolId = toolId;
    Object.setPrototypeOf(this, ToolExecutionError.prototype);
  }
}

/**
 * Check if error is SDK error
 */
export function isChatError(error: unknown): error is ChatError {
  return error instanceof ChatError;
}

/**
 * Check if error is connection error
 */
export function isConnectionError(error: unknown): error is ConnectionError {
  return error instanceof ConnectionError;
}

/**
 * Check if error is parse error
 */
export function isParseError(error: unknown): error is ParseError {
  return error instanceof ParseError;
}

/**
 * Check if error is stream error
 */
export function isStreamError(error: unknown): error is StreamError {
  return error instanceof StreamError;
}

/**
 * Check if error is API error
 */
export function isAPIError(error: unknown): error is APIError {
  return error instanceof APIError;
}

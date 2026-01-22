/**
 * WebSocket 传输层
 *
 * @internal SDK内部使用
 */

import type {
  MessageCallback,
  StreamCallbacks,
  AssistantMessage,
  SessionConfig,
  RetryConfig,
} from '../types';
import type {
  ClientMessage,
  ServerMessage,
  StreamEventMessage,
  SystemMessage,
} from './protocol';
import { ProtocolNormalizer, StreamBuffer } from './normalizer';
import {
  ConnectionError,
  ConnectionTimeoutError,
  ParseError,
  StreamError,
} from '../errors';

/**
 * 监听器条目
 */
interface ListenerEntry {
  id: number;
  callback: MessageCallback;
  streamCallbacks?: StreamCallbacks;
}

/**
 * WebSocket 传输层
 */
export class WebSocketTransport {
  private ws: WebSocket | null = null;
  private listeners: ListenerEntry[] = [];
  private nextListenerId: number = 1;
  private streamBuffer = new StreamBuffer();
  private conversationId: string = '';
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatInterval: number = 30000; // 30秒心跳间隔
  private retryConfig: Required<RetryConfig>;
  private currentRetry: number = 0;

  constructor(
    private wsURL: string,
    private timeout: number = 30000,
    private defaultSessionConfig?: SessionConfig,
    retryConfig?: RetryConfig
  ) {
    // 合并重试配置
    this.retryConfig = {
      maxRetries: retryConfig?.maxRetries ?? 2,
      initialDelay: retryConfig?.initialDelay ?? 1000,
      maxDelay: retryConfig?.maxDelay ?? 60000,
      backoffMultiplier: retryConfig?.backoffMultiplier ?? 2,
    };
  }

  /**
   * 连接WebSocket（带自动重试）
   */
  async connect(
    conversationId: string,
    appId: string,
    sessionConfig?: SessionConfig,
    lastMessageCreatedAt?: number
  ): Promise<void> {
    this.conversationId = conversationId;
    this.currentRetry = 0;

    while (this.currentRetry <= this.retryConfig.maxRetries) {
      try {
        await this.attemptConnect(conversationId, appId, sessionConfig, lastMessageCreatedAt);
        return; // 连接成功，退出重试循环
      } catch (error) {
        const isLastAttempt = this.currentRetry >= this.retryConfig.maxRetries;

        if (isLastAttempt) {
          // 最后一次尝试失败，抛出错误
          console.error('[SeaLink] All connection attempts failed');
          throw error;
        }

        // 计算退避延迟
        const delay = this.getRetryDelay(this.currentRetry);
        console.log(`[SeaLink] Connection failed (attempt ${this.currentRetry + 1}/${this.retryConfig.maxRetries + 1}), retrying in ${delay}ms...`);

        // 等待后重试
        await this.sleep(delay);
        this.currentRetry++;
      }
    }
  }

  /**
   * 发送消息
   */
  send(message: ClientMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    this.ws.send(JSON.stringify(message));
  }

  /**
   * 发送用户消息
   */
  sendUserMessage(conversationId: string, content: string): void {
    this.send({
      type: 'user',
      conversation_id: conversationId,
      message: {
        content,
      },
    });
  }

  /**
   * 中断当前执行
   */
  interrupt(): void {
    this.send({
      type: 'interrupt',
    });
  }

  /**
   * 注册消息回调（支持多个监听器）
   * @returns 取消订阅函数
   */
  onMessage(
    callback: MessageCallback,
    streamCallbacks?: StreamCallbacks
  ): () => void {
    const id = this.nextListenerId++;
    this.listeners.push({
      id,
      callback,
      streamCallbacks,
    });

    // 返回取消订阅函数
    return () => {
      this.listeners = this.listeners.filter((listener) => listener.id !== id);
    };
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(data: string): void {
    try {
      const serverMsg: ServerMessage = JSON.parse(data);

      console.log('[SeaLink] Received message:', serverMsg);

      // 处理流式事件
      if (serverMsg.type === 'stream_event') {
        this.handleStreamEvent(serverMsg);
        return;
      }

      // 处理系统消息
      if (serverMsg.type === 'system') {
        this.handleSystemMessage(serverMsg);
        return;
      }

      // 处理普通消息
      const messages = ProtocolNormalizer.normalize(
        serverMsg,
        this.conversationId
      );

      messages.forEach((msg) => {
        // 通知所有监听器
        this.listeners.forEach((listener) => {
          listener.callback(msg);
        });
      });
    } catch (error) {
      console.error('[SeaLink] Failed to parse message:', error);
      console.error('[SeaLink] Raw message data:', data);

      // 使用具体的错误类型
      const parseError = error instanceof ParseError
        ? error
        : new ParseError(
            error instanceof Error ? error.message : 'Failed to parse server message',
            data
          );

      // 通知所有监听器的错误回调
      this.listeners.forEach((listener) => {
        listener.streamCallbacks?.onError?.(parseError);
      });
    }
  }

  /**
   * 处理系统消息
   */
  private handleSystemMessage(msg: SystemMessage): void {
    console.log('[SeaLink] System message:', {
      subtype: msg.subtype,
      session_id: msg.session_id,
      model: msg.model,
      tools: msg.tools?.length,
    });

    // 通知所有监听器
    this.listeners.forEach((listener) => {
      listener.streamCallbacks?.onSystem?.({
        sessionId: msg.session_id,
        model: msg.model,
        version: msg.seaverse_version,
        agents: msg.agents,
        tools: msg.tools,
        skills: msg.skills,
      });
    });
  }

  /**
   * 处理流式事件
   */
  private handleStreamEvent(event: StreamEventMessage): void {
    try {
      const conversationId = this.conversationId;
      const eventBlock = event.event; // event 现在是对象而不是字符串

    if (eventBlock.type === 'content_block_start') {
      // 流式开始
      this.streamBuffer.start(conversationId);
      console.log('[SeaLink] Stream started');
    } else if (eventBlock.type === 'content_block_delta') {
      // 增量内容
      const delta = eventBlock.delta; // delta 在 event 对象里，不在 data 里
      if (!delta) return;

      let chunk = '';
      if (delta.type === 'text_delta' && delta.text) {
        chunk = delta.text;
      } else if (delta.type === 'thinking_delta' && delta.thinking) {
        // 思考内容也可以流式显示（可选）
        chunk = delta.thinking;
      }

      if (chunk) {
        // 累积到缓冲区
        const fullContent = this.streamBuffer.append(conversationId, chunk);

        // ✅ 通知所有监听器的 onChunk 回调
        this.listeners.forEach((listener) => {
          listener.streamCallbacks?.onChunk?.(chunk);
        });

        console.log('[SeaLink] Stream chunk:', chunk, '(total:', fullContent.length, ')');
      }
    } else if (eventBlock.type === 'content_block_stop') {
      // 流式完成
      const fullContent = this.streamBuffer.complete(conversationId);

      // 创建完整消息
      const message: AssistantMessage = {
        id: this.generateId(),
        conversationId,
        role: 'assistant',
        content: fullContent,
        createdAt: Date.now(),
      };

      console.log('[SeaLink] Stream completed, total length:', fullContent.length);

      // ✅ 先通知所有监听器的流式完成回调
      this.listeners.forEach((listener) => {
        listener.streamCallbacks?.onComplete?.();
      });

      // ✅ 再通知所有监听器的主回调（传递完整消息）
      this.listeners.forEach((listener) => {
        listener.callback(message);
      });
    }
    } catch (error) {
      console.error('[SeaLink] Stream event handling error:', error);

      const streamError = new StreamError(
        error instanceof Error ? error.message : 'Stream processing failed',
        this.conversationId
      );

      // 通知所有监听器的错误回调
      this.listeners.forEach((listener) => {
        listener.streamCallbacks?.onError?.(streamError);
      });
    }
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * 检查连接状态
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * 生成消息ID
   */
  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * 启动心跳定时器
   */
  private startHeartbeat(): void {
    // 先清理可能存在的旧定时器
    this.stopHeartbeat();

    // 启动新的心跳定时器
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected()) {
        console.log('[SeaLink] Sending heartbeat');
        this.send({
          type: 'heartbeat',
        });
      }
    }, this.heartbeatInterval);

    console.log('[SeaLink] Heartbeat started, interval:', this.heartbeatInterval, 'ms');
  }

  /**
   * 停止心跳定时器
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
      console.log('[SeaLink] Heartbeat stopped');
    }
  }

  /**
   * 计算重试延迟（指数退避）
   */
  private getRetryDelay(attempt: number): number {
    const delay = Math.min(
      this.retryConfig.initialDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt),
      this.retryConfig.maxDelay
    );
    return delay;
  }

  /**
   * 等待指定时间
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 执行单次连接尝试
   */
  private async attemptConnect(
    conversationId: string,
    appId: string,
    sessionConfig?: SessionConfig,
    lastMessageCreatedAt?: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.wsURL);

        this.ws.onopen = () => {
          console.log('[SeaLink] WebSocket connected');

          // 合并配置：参数 > 默认配置 > 内置默认值
          const config = {
            model: sessionConfig?.model || this.defaultSessionConfig?.model || 'claude-sonnet-4',
            max_turns: sessionConfig?.max_turns || this.defaultSessionConfig?.max_turns || 100,
          };

          // 发送初始化消息
          this.send({
            type: 'init_session',
            conversation_id: conversationId,
            app_id: appId,
            config,
            last_message_created_at: lastMessageCreatedAt,
          });

          // 启动心跳定时器
          this.startHeartbeat();

          // 连接成功，重置重试计数
          this.currentRetry = 0;

          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          console.error('[SeaLink] WebSocket error:', error);
          const wsError = new ConnectionError('WebSocket connection error');
          reject(wsError);
        };

        this.ws.onclose = () => {
          console.log('[SeaLink] WebSocket closed');
          // 停止心跳定时器
          this.stopHeartbeat();
        };

        // 超时处理
        setTimeout(() => {
          if (this.ws?.readyState !== WebSocket.OPEN) {
            reject(new ConnectionTimeoutError(this.timeout));
          }
        }, this.timeout);
      } catch (error) {
        reject(error instanceof Error ? error : new ConnectionError('Unknown connection error'));
      }
    });
  }
}

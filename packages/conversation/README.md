# @seaverse/conversation-sdk

SeaVerse Conversation SDK - 用于对话（Conversations）和消息（Messages）管理的函数式 SDK。

## 安装

```bash
npm install @seaverse/conversation-sdk
# 或
pnpm add @seaverse/conversation-sdk
```

## 快速开始

### 初始化 SDK

```typescript
import { initConversationSdk } from '@seaverse/conversation-sdk';

const sdk = initConversationSdk({
  environment: 'prod', // 'dev' | 'prod'
  token: 'your-access-token'
});
```

### 获取 Apps 及其会话列表

```typescript
// 获取所有 apps,每个 app 返回消息数最多的一个会话
const result = await sdk.getAppsWithConversationsList({
  page: 1,
  pageSize: 20
});

console.log(result.apps);     // AppWithConversations[]
console.log(result.hasMore);  // boolean - 是否有下一页

// 获取指定 app
const appResult = await sdk.getAppsWithConversationsList({
  appId: 'app-123',
  page: 1,
  pageSize: 20
});
```

### 获取消息列表

```typescript
// 获取指定会话的消息列表（倒序,最新的在前）
const result = await sdk.getMessagesList('conversation-id', {
  page: 1,
  pageSize: 50
});

console.log(result.messages);  // Message[]
console.log(result.hasMore);   // boolean - 是否有下一页
```

## API 参考

### initConversationSdk(config)

初始化 Conversation SDK 并返回函数式 API。

**参数**:
```typescript
{
  environment: 'dev' | 'prod';        // 环境配置
  token: string;                      // 访问令牌
  getToken?: () => Promise<string>;   // 动态获取令牌（可选）
  fetch?: typeof fetch;               // 自定义 fetch 实现（可选）
  timeout?: number;                   // 请求超时时间，默认 30000ms（可选）
}
```

**返回**: 包含以下方法的对象

### getAppsWithConversationsList(options?)

获取 Apps 列表,每个 app 只返回消息数最多的那一个会话。

**参数**:
```typescript
{
  appId?: string;      // 可选,按应用 ID 过滤
  page?: number;       // 页码,默认 1
  pageSize?: number;   // 每页数量,默认 20
}
```

**返回**:
```typescript
Promise<{
  apps: AppWithConversations[];
  hasMore: boolean;  // 是否有下一页
}>
```

### getMessagesList(conversationId, options?)

获取指定会话的消息列表（按时间倒序,最新消息在前）。

**参数**:
- `conversationId`: `string` - 会话 ID（必需）
- `options?`: 可选查询选项
  ```typescript
  {
    page?: number;       // 页码,默认 1
    pageSize?: number;   // 每页数量,默认 100
  }
  ```

**返回**:
```typescript
Promise<{
  messages: Message[];
  hasMore: boolean;  // 是否有下一页
}>
```

## 类型定义

### Message

```typescript
interface Message {
  id: string;
  role?: 'user' | 'assistant' | 'system';  // tips 消息无 role
  content?: string;                         // tips 消息不返回此字段
  timestamp: number;                        // 秒级时间戳
  type?: 'text' | 'conversation_tips' | string;
  tips?: string[];                          // conversation_tips 类型专有
  toolCalls?: ToolCall[];                   // 工具调用信息
}
```

**Tips 消息格式**:
```typescript
{
  id: string;
  conversation_id: string;  // 仅 tips 消息有此字段
  timestamp: number;
  type: "conversation_tips";
  tips: string[];
  // 注意: tips 消息没有 content 和 role 字段
}
```

### ToolCall

```typescript
interface ToolCall {
  id: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  isCompleted: boolean;
}
```

### Conversation

```typescript
interface Conversation {
  id: string;
  title: string;
  appId: string | null;
  userId: string;
  createdAt: number;        // 毫秒时间戳
  updatedAt: number;        // 毫秒时间戳
  lastActiveAt: number;     // 毫秒时间戳
  messageCount?: number;    // 消息计数
}
```

### AppWithConversations

```typescript
interface AppWithConversations {
  app: App;
  conversations: Conversation[];  // 只有一个元素(消息数最多的会话)
}
```

### App

```typescript
interface App {
  id: string;
  name: string;
  displayName: string;
  description: string;
  thumbnailUrls: string[];
  userName: string;
  version: string;
  tags: string[] | null;
  status: 'draft' | 'published' | 'archived';
  positiveCount: number;
  forkCount: number;
  commentCount: number;
  createdAt: number;        // 毫秒时间戳
  updatedAt: number;        // 毫秒时间戳
}
```

## 错误处理

SDK 提供了几种错误类型：

```typescript
import {
  BaseError,
  NetworkError,
  AuthError,
  TimeoutError,
  ProtocolError
} from '@seaverse/conversation-sdk';

try {
  const result = await sdk.getAppsWithConversationsList();
} catch (error) {
  if (error instanceof AuthError) {
    console.error('认证失败:', error.message);
  } else if (error instanceof NetworkError) {
    console.error('网络错误:', error.message);
  } else if (error instanceof TimeoutError) {
    console.error('请求超时:', error.message);
  } else {
    console.error('未知错误:', error);
  }
}
```

## 完整示例

```typescript
import { initConversationSdk } from '@seaverse/conversation-sdk';

// 初始化 SDK
const sdk = initConversationSdk({
  environment: 'prod',
  token: 'your-access-token'
});

// 1. 获取所有 apps 及其热门会话
const appsResult = await sdk.getAppsWithConversationsList({
  page: 1,
  pageSize: 20
});

console.log('Apps:', appsResult.apps);
console.log('有下一页:', appsResult.hasMore);

// 2. 获取某个会话的消息
const conversationId = appsResult.apps[0]?.conversations[0]?.id;
if (conversationId) {
  const messagesResult = await sdk.getMessagesList(conversationId, {
    page: 1,
    pageSize: 50
  });

  console.log('消息列表:', messagesResult.messages);
  console.log('有更多消息:', messagesResult.hasMore);

  // 处理不同类型的消息
  messagesResult.messages.forEach(msg => {
    if (msg.type === 'conversation_tips') {
      console.log('Tips:', msg.tips);
    } else {
      console.log('消息:', msg.content);
    }
  });
}
```

## 环境配置

SDK 会根据 `environment` 参数自动选择对应的服务端点：

- `'dev'`: 开发环境
- `'prod'`: 生产环境

## 许可证

MIT

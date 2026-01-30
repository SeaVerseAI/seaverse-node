# @sealink/runtime

SeaLink Runtime SDK - 用于对话（Conversations）和消息（Messages）管理的统一 SDK。

## 安装

```bash
npm install @sealink/runtime
# 或
pnpm add @sealink/runtime
```

## 快速开始

### 创建客户端

```typescript
import { createClient } from '@sealink/runtime';

const client = createClient({
  environment: 'prod', // 'dev' | 'prod'
  token: 'your-access-token'
});
```

### 管理对话（Conversations）

```typescript
// 获取对话列表
const conversations = await client.conversations.list({
  page: 1,
  pageSize: 10
});

console.log(conversations.data); // Conversation[]
console.log(conversations.meta); // { total, page, pageSize, totalPages }

// 创建新对话
const newConversation = await client.conversations.create({
  appId: 'app-123',
  title: '我的对话'
});

// 获取单个对话
const conversation = await client.conversations.get('conversation-id');

// 更新对话
const updated = await client.conversations.update('conversation-id', {
  title: '新标题'
});

// 删除对话
await client.conversations.delete('conversation-id');
```

### 获取消息（Messages）

```typescript
// 获取对话的消息列表（默认倒序，最新的在前）
const messages = await client.messages.list('conversation-id', {
  page: 1,
  pageSize: 20
});

console.log(messages.data); // Message[]（按时间倒序）
console.log(messages.pagination); // { total, page, pageSize, totalPages }
```

## API 参考

### createClient(config)

创建 Runtime 客户端实例。

**参数**:
- `config.environment`: `'dev' | 'prod'` - 环境配置
- `config.token`: `string` - 访问令牌
- `config.getToken?`: `() => Promise<string>` - 动态获取令牌（可选）
- `config.fetch?`: `typeof fetch` - 自定义 fetch 实现（可选）
- `config.timeout?`: `number` - 请求超时时间，默认 30000ms（可选）

**返回**: `RuntimeClient`

### client.conversations

对话资源管理。

#### list(options?)

获取对话列表。

**参数**:
```typescript
{
  appId?: string;           // 按应用 ID 过滤
  page?: number;            // 页码，默认 1
  pageSize?: number;        // 每页数量，默认 10
}
```

**返回**: `Promise<PaginatedResult<Conversation>>`

#### create(data)

创建新对话。

**参数**:
```typescript
{
  appId: string;           // 应用 ID
  title?: string;          // 对话标题
}
```

**返回**: `Promise<Conversation>`

#### get(id)

获取单个对话。

**返回**: `Promise<Conversation | null>`

#### update(id, data)

更新对话。

**参数**:
```typescript
{
  title?: string;          // 对话标题
}
```

**返回**: `Promise<Conversation>`

#### delete(id)

删除对话。

**返回**: `Promise<void>`

### client.messages

消息资源查询（只读）。

#### list(conversationId, options?)

获取指定对话的消息列表（按时间倒序，最新消息在前）。

**参数**:
- `conversationId`: `string` - 对话 ID（必需）
- `options?`: 可选查询选项
  ```typescript
  {
    page?: number;           // 页码，默认 1
    pageSize?: number;       // 每页数量，默认 100
  }
  ```

**返回**: `Promise<PaginatedResult<Message>>`

## 类型定义

### Conversation

```typescript
interface Conversation {
  id: string;
  appId: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}
```

### Message

```typescript
interface Message {
  id: string;
  conversationId: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  createdAt: string;
  updatedAt: string;
}
```

### PaginatedResult

```typescript
interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
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
} from '@sealink/runtime';

try {
  await client.conversations.list();
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

## 环境配置

SDK 会根据 `environment` 参数自动选择对应的服务端点：

- `'dev'`: 开发环境
- `'prod'`: 生产环境

## 许可证

MIT

# @seaverse/conversation-sdk

SeaVerse Conversation SDK - A functional SDK for managing conversations and messages.

## Installation

```bash
npm install @seaverse/conversation-sdk
# or
pnpm add @seaverse/conversation-sdk
```

## Quick Start

### Initialize SDK

```typescript
import { initConversationSdk } from '@seaverse/conversation-sdk';

const sdk = initConversationSdk({
  environment: 'prod', // 'dev' | 'prod'
  token: 'your-access-token'
});
```

### Get Conversations List

```typescript
// Get all conversations with pagination
const result = await sdk.getConversationsList({
  userId: 'user-123',
  appId: 'app-456',
  page: 1,
  pageSize: 20
});

console.log(result.data);        // Conversation[]
console.log(result.pagination);  // Pagination info
```

### Create Conversation

```typescript
// Create a new conversation
const conversation = await sdk.createConversation({
  title: 'My Conversation',
  appId: 'app-123',
  userId: 'user-456'
});

console.log(conversation.conversation_id);  // New conversation ID
```

### Delete Conversation

```typescript
// Delete a conversation
await sdk.deleteConversation('conversation-id');
```

### Get Apps with Conversations

```typescript
// Get all apps, each app returns all conversations sorted by updated time
const result = await sdk.getAppsWithConversationsList({
  page: 1,
  pageSize: 20
});

console.log(result.apps);     // AppWithConversations[]
console.log(result.hasMore);  // boolean - whether there's a next page

// Get a specific app
const appResult = await sdk.getAppsWithConversationsList({
  appId: 'app-123',
  page: 1,
  pageSize: 20
});
```

### Get Messages List

```typescript
// Get message list for a conversation (descending order, newest first)
const result = await sdk.getMessagesList('conversation-id', {
  page: 1,
  pageSize: 50
});

console.log(result.messages);  // Message[]
console.log(result.hasMore);   // boolean - whether there's a next page
```

## API Reference

### initConversationSdk(config)

Initialize the Conversation SDK and return functional API.

**Parameters**:
```typescript
{
  environment: 'dev' | 'prod';        // Environment configuration
  token: string;                      // Access token
  getToken?: () => Promise<string>;   // Dynamic token getter (optional)
  fetch?: typeof fetch;               // Custom fetch implementation (optional)
  timeout?: number;                   // Request timeout, default 30000ms (optional)
}
```

**Returns**: Object containing the following methods:
- `getConversationsList` - Get conversations list with pagination
- `getAppsWithConversationsList` - Get apps with their conversations
- `getMessagesList` - Get messages for a conversation
- `createConversation` - Create a new conversation
- `deleteConversation` - Delete a conversation

---

### getConversationsList(options?)

Get list of conversations with pagination.

**Parameters**:
```typescript
{
  appId?: string;                           // Filter by app ID
  userId?: string;                          // Filter by user ID
  orderBy?: 'createdAt' | 'updatedAt' | 'lastActiveAt';  // Sort field, default 'createdAt'
  order?: 'asc' | 'desc';                   // Sort direction, default 'desc'
  page?: number;                            // Page number, default 1
  pageSize?: number;                        // Items per page, default 20
}
```

**Returns**:
```typescript
Promise<{
  data: Conversation[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}>
```

---

### createConversation(data)

Create a new conversation.

**Parameters**:
```typescript
{
  title: string;              // Conversation title
  appId?: string | null;      // Associated app ID (optional)
  userId: string;             // User ID
}
```

**Returns**:
```typescript
Promise<ConversationResponse>
```

The response includes:
```typescript
{
  conversation_id: string;
  app_id: string | null;
  backend: string;
  backend_session_id: string | null;
  title: string;
  created_at: number;       // Unix timestamp in seconds
  updated_at: number;       // Unix timestamp in seconds
  message_count: number;
  skills_json: any | null;
  metadata: Record<string, unknown>;
  user_id: string;
}
```

---

### deleteConversation(conversationId)

Delete a conversation by ID.

**Parameters**:
- `conversationId`: `string` - Conversation ID to delete

**Returns**: `Promise<void>`

---

### getAppsWithConversationsList(options?)

Get list of apps with their conversations. Each app returns all conversations sorted by updated time (newest first).

**Parameters**:
```typescript
{
  appId?: string;      // Optional, filter by app ID
  page?: number;       // Page number, default 1
  pageSize?: number;   // Items per page, default 20
}
```

**Returns**:
```typescript
Promise<{
  apps: AppWithConversations[];
  hasMore: boolean;  // Whether there's a next page
}>
```

---

### getMessagesList(conversationId, options?)

Get message list for a conversation (descending order by time, newest first).

**Parameters**:
- `conversationId`: `string` - Conversation ID (required)
- `options?`: Optional query options
  ```typescript
  {
    page?: number;       // Page number, default 1
    pageSize?: number;   // Items per page, default 100
  }
  ```

**Returns**:
```typescript
Promise<{
  messages: Message[];
  hasMore: boolean;  // Whether there's a next page
}>
```

## Type Definitions

### Conversation

```typescript
interface Conversation {
  id: string;
  title: string;
  appId: string | null;
  userId: string;
  createdAt: number;        // Unix timestamp in milliseconds
  updatedAt: number;        // Unix timestamp in milliseconds
  lastActiveAt: number;     // Unix timestamp in milliseconds
  messageCount?: number;    // Message count
}
```

### ConversationResponse

API response format (snake_case, matches runtime-plugins):

```typescript
interface ConversationResponse {
  conversation_id: string;
  app_id: string | null;
  backend: string;
  backend_session_id: string | null;
  title: string;
  created_at: number;       // Unix timestamp in seconds
  updated_at: number;       // Unix timestamp in seconds
  message_count: number;
  skills_json: any | null;
  metadata: Record<string, unknown>;
  user_id: string;
}
```

### Message

消息模型采用「全量透传」策略，完全对齐 `runtime-plugins/conversations` 的 `getMessages` 返回结构。
当 `content` 是 JSON 对象时，其所有字段都会被展开透传；下方列出的是已知字段，未知字段也会保留。

```typescript
interface Message {
  id: string;
  role?: 'user' | 'assistant' | 'system';
  content?: string;
  timestamp: number;                        // Unix timestamp in seconds
  type?: 'text' | 'media' | 'conversation_tips' | 'app_creation_detected' | string;
  tips?: string[];                          // conversation_tips 类型专用
  toolCalls?: ToolCall[];                   // 工具调用信息
  media?: MessageMedia;                     // 媒体资源（图片/音频/视频）
  todos?: TodoItem[];                       // 待办事项列表
  attachments?: MessageAttachment[];        // 文件附件
  metadata_json?: string | null;            // 元数据 JSON（用于去重判断等）
  // app_creation_detected 类型专用
  app_id?: string;
  app_name?: string;
  app_description?: string;
  // 索引签名：允许透传 content JSON 中的未知字段
  [key: string]: unknown;
}
```

**Tips Message Format**:
```typescript
{
  id: string;
  conversation_id: string;  // Only tips messages have this field
  timestamp: number;
  type: "conversation_tips";
  tips: string[];
  // Note: tips messages don't have content and role fields
}
```

**Media Message Format**:
```typescript
{
  id: string;
  role: "assistant";
  content: "";
  timestamp: number;
  type: "media";
  media: {
    images?: string[];
    audios?: string[];
    videos?: string[];
  }
}
```

### MessageMedia

```typescript
interface MessageMedia {
  images?: string[];
  audios?: string[];
  videos?: string[];
}
```

### TodoItem

```typescript
interface TodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | string;
}
```

### MessageAttachment

```typescript
interface MessageAttachment {
  type: 'image' | 'document' | string;
  media_type?: string;
  file_id?: string;
  filename?: string;
  url?: string;
  size?: number;
  path?: string;
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

### AppWithConversations

```typescript
interface AppWithConversations {
  app: App;
  conversations: Conversation[];  // All conversations sorted by updatedAt desc
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
  createdAt: number;        // Unix timestamp in milliseconds
  updatedAt: number;        // Unix timestamp in milliseconds
}
```

## Error Handling

The SDK provides several error types:

```typescript
import {
  BaseError,
  NetworkError,
  AuthError,
  TimeoutError,
  ProtocolError
} from '@seaverse/conversation-sdk';

try {
  const result = await sdk.getConversationsList();
} catch (error) {
  if (error instanceof AuthError) {
    console.error('Authentication failed:', error.message);
  } else if (error instanceof NetworkError) {
    console.error('Network error:', error.message);
  } else if (error instanceof TimeoutError) {
    console.error('Request timeout:', error.message);
  } else if (error instanceof ProtocolError) {
    console.error('Protocol error:', error.message);
  } else {
    console.error('Unknown error:', error);
  }
}
```

## Complete Example

```typescript
import { initConversationSdk } from '@seaverse/conversation-sdk';

// Initialize SDK
const sdk = initConversationSdk({
  environment: 'prod',
  token: 'your-access-token'
});

// 1. Create a new conversation
const newConversation = await sdk.createConversation({
  title: 'My New Chat',
  appId: 'app-123',
  userId: 'user-456'
});
console.log('Created:', newConversation.conversation_id);

// 2. Get conversations list
const conversations = await sdk.getConversationsList({
  userId: 'user-456',
  page: 1,
  pageSize: 10
});
console.log('Conversations:', conversations.data);
console.log('Total:', conversations.pagination.total);

// 3. Get all apps with their conversations
const appsResult = await sdk.getAppsWithConversationsList({
  page: 1,
  pageSize: 20
});
console.log('Apps:', appsResult.apps);
console.log('Has more:', appsResult.hasMore);

// 4. Get messages for a conversation
const conversationId = conversations.data[0]?.id;
if (conversationId) {
  const messagesResult = await sdk.getMessagesList(conversationId, {
    page: 1,
    pageSize: 50
  });

  console.log('Messages:', messagesResult.messages);
  console.log('Has more messages:', messagesResult.hasMore);

  // Handle different message types
  messagesResult.messages.forEach(msg => {
    switch (msg.type) {
      case 'conversation_tips':
        console.log('Tips:', msg.tips);
        break;
      case 'media':
        console.log('Media:', msg.media);   // { images, audios, videos }
        break;
      case 'app_creation_detected':
        console.log('App created:', msg.app_id, msg.app_name);
        break;
      default:
        console.log('Message:', msg.content);
        if (msg.toolCalls) console.log('Tool calls:', msg.toolCalls);
        if (msg.todos) console.log('Todos:', msg.todos);
        if (msg.attachments) console.log('Attachments:', msg.attachments);
    }
  });
}

// 5. Delete a conversation
await sdk.deleteConversation(newConversation.conversation_id);
console.log('Deleted:', newConversation.conversation_id);
```

## Environment Configuration

The SDK automatically selects the corresponding service endpoint based on the `environment` parameter:

- `'dev'`: Development environment (https://postgrest.sg.seaverse.dev)
- `'prod'`: Production environment (https://db.seaverse.ai)

## License

MIT

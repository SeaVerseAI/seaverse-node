# SeaLink SDK 测试指南

## 📋 概述

[test.html](test.html) 是一个综合测试平台，用于测试 SeaLink SDK 的所有核心功能。

## 🚀 快速开始

### 1. 构建 SDK 包

首先需要构建所有 SDK 包：

```bash
# 安装依赖
pnpm install

# 构建所有包
pnpm -r build
```

### 2. 打开测试页面

```bash
# 推荐：使用内置 dev-server（静态托管 + 同源代理，解决 CORS）
node dev-server.mjs
# 然后访问 http://localhost:4173/test.html

# 备用：仅静态托管（跨域接口会触发 CORS，无法真实请求）
# npx http-server . -p 8080
# 然后访问 http://localhost:8080/test.html
```

## 🧪 测试模块

### 1. Core Transport 测试 📡

**功能**: 测试 HTTP 客户端创建和配置

**测试步骤**:
1. 输入 Base URL (默认: `https://db.seaverse.ai`)
2. 输入 Auth Token
3. 点击"测试 HTTP 客户端"按钮
4. 查看输出日志

**实际集成方法**:
```typescript
import { createHttpClient } from '@sealink/core-transport';

const http = createHttpClient({
  baseUrl: 'https://db.seaverse.ai',
  getAuthToken: () => localStorage.getItem('token'),
});
```

### 2. Data PostgREST 测试 🗄️

**功能**: 测试 PostgREST 客户端查询配置

**测试步骤**:
1. 输入表名 (默认: `conversations`)
2. 配置过滤条件 (PostgREST 格式，如: `user_id=eq.123`)
3. 配置排序规则 (如: `created_at.desc`)
4. 设置查询限制
5. 点击"查询数据"按钮

**实际集成方法**:
```typescript
import { DbClient } from '@sealink/data-postgrest';

const db = new DbClient(http);
const result = await db.from('conversations').list({
  filter: { user_id: 'eq.123' },
  order: 'created_at.desc',
  limit: 10
});
```

### 3. Runtime Conversations 测试 💬

**功能**: 测试会话和消息管理功能

**支持的操作**:
- 获取会话列表
- 获取应用和会话聚合数据
- 获取消息列表

**测试步骤**:
1. 输入 User ID
2. 选择操作类型
3. 如果选择"获取消息列表"，需要输入 Conversation ID
4. 点击"执行操作"按钮

**实际集成方法**:

```typescript
// 获取会话列表
import { ConversationsClient } from '@sealink/runtime-conversations';

const conversations = new ConversationsClient(db);
const result = await conversations.list({
  filter: { user_id: 'eq.123' },
  order: 'created_at.desc',
  limit: 10
});

// 获取应用和会话聚合数据
import { listAppsWithConversations } from '@sealink/runtime-conversations';
import { getUrlSessionToken } from '@sealink/runtime-session';

const result = await listAppsWithConversations({
  db,
  getUrlSessionToken,
  accessToken: 'user-token',
  authBaseUrl: 'https://auth.sg.seaverse.dev'
});

// 获取消息列表
import { MessagesClient } from '@sealink/runtime-conversations';

const messages = new MessagesClient(db);
const result = await messages.list({
  filter: { conversation_id: 'eq.conv-123' },
  order: 'created_at.asc',
  limit: 50
});
```

### 4. Chat WebSocket 测试 🚀

**功能**: 测试 WebSocket 聊天功能

**测试步骤**:

1. **连接配置**:
   - 输入 Base URL (默认: `https://sandbox.sg.seaverse.ai/`)
   - 输入 Token
   - 输入 Conversation ID
   - 输入 App ID
   - 点击"连接 WebSocket"

2. **发送消息**:
   - 在文本框中输入消息
   - 点击"发送消息"
   - 查看消息列表中的用户消息和助手回复

3. **中断执行**:
   - 点击"中断执行"按钮

4. **断开连接**:
   - 点击"断开连接"按钮

**实际集成方法**:

```typescript
import { createChat } from '@sealink/chat';

const chat = createChat({
  baseURL: 'https://sandbox.sg.seaverse.ai/',
  token: 'your-token',
  conversationId: 'conv-123',
  appId: 'app-123'
});

// 连接
await chat.connect({
  sessionConfig: {
    model: 'claude-opus-4',
    max_turns: 200
  },
  lastMessageCreatedAt: Date.now()
});

// 监听消息（支持流式）
chat.onMessage(
  // 主回调: 接收完整消息
  (msg) => {
    messageList.push(msg);
    console.log('收到消息:', msg.content);
  },
  // 流式回调: 实时显示
  {
    onChunk: (chunk) => {
      // 追加流式内容
      streamingDiv.textContent += chunk;
    },
    onComplete: () => {
      // 清理流式状态
      console.log('流式完成');
    },
    onError: (error) => {
      console.error('流式错误:', error);
    }
  }
);

// 发送消息
const userMsg = await chat.sendMessage('Hello!');

// 中断执行
await chat.interrupt();

// 断开连接
await chat.disconnect();
```

## 🔧 如何集成真实 SDK

当前 `test.html` 是一个模拟页面。要使用真实的 SDK，需要：

### 方法 1: 使用构建工具 (推荐)

```typescript
// 使用 Vite, Webpack 等构建工具
import { createHttpClient } from '@sealink/core-transport';
import { DbClient } from '@sealink/data-postgrest';
import { createChat } from '@sealink/chat';

// ... 使用 SDK
```

### 方法 2: 使用 Import Maps (浏览器原生)

在 HTML 中添加：

```html
<script type="importmap">
{
  "imports": {
    "@sealink/core-transport": "./packages/core-transport/dist/index.js",
    "@sealink/data-postgrest": "./packages/data-postgrest/dist/index.js",
    "@sealink/runtime-conversations": "./packages/runtime-conversations/dist/index.js",
    "@sealink/chat": "./packages/chat/dist/index.js"
  }
}
</script>

<script type="module">
import { createHttpClient } from '@sealink/core-transport';
// ... 使用 SDK
</script>
```

### 方法 3: 使用 CDN (未来支持)

```html
<script type="module">
import { createHttpClient } from 'https://cdn.example.com/@sealink/core-transport@0.1.0/index.js';
// ... 使用 SDK
</script>
```

## 📊 架构层级

```
┌─────────────────────────────────────┐
│     Chat WebSocket SDK              │  实时通信
├─────────────────────────────────────┤
│  Runtime Conversations              │  会话管理
├─────────────────────┬───────────────┤
│  Data PostgREST     │ Runtime Session│  数据 & 会话
├─────────────────────┴───────────────┤
│      Core Transport                 │  HTTP 客户端
├─────────────────────────────────────┤
│      Core Common                    │  共享类型
└─────────────────────────────────────┘
```

## 🎯 测试检查清单

- [ ] Core Transport 能否成功创建 HTTP 客户端
- [ ] PostgREST 查询参数配置是否正确
- [ ] Conversations 客户端能否列出会话
- [ ] Messages 客户端能否列出消息
- [ ] 聚合接口能否返回应用和会话数据
- [ ] WebSocket 能否成功连接
- [ ] 消息能否成功发送和接收
- [ ] 流式消息是否正常显示
- [ ] 中断功能是否工作
- [ ] 断开连接是否正常

## 🔐 安全注意事项

1. **XSS 防护**: 测试页面已使用 `textContent` 而非 `innerHTML`，防止 XSS 攻击
2. **Token 管理**: 不要在生产环境中硬编码 token
3. **HTTPS**: 生产环境必须使用 HTTPS
4. **CORS**: 确保后端正确配置 CORS

## 📝 常见问题

### Q: 为什么点击按钮没有实际请求?

A: 当前是模拟页面。要发送真实请求，需要按照上面"如何集成真实 SDK"部分进行集成。

### Q: 如何调试 WebSocket 连接?

A: 打开浏览器开发者工具的 Network 标签，筛选 WS (WebSocket) 类型的请求。

### Q: PostgREST 过滤器格式是什么?

A: 参考 [PostgREST API 文档](https://postgrest.org/en/stable/api.html)，例如:
- `user_id=eq.123` (等于)
- `created_at=gte.2024-01-01` (大于等于)
- `title=like.*test*` (模糊匹配)

## 🔗 相关链接

- [项目 README](./README.md)
- [架构设计文档](./docs/plans/2026-01-28-runtime-sdk-refactor-design-with-builder-sdk.md)
- [PostgREST API 文档](https://postgrest.org/en/stable/api.html)

## 📄 许可证

MIT

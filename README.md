# SeaLink SDKs

SeaVerse 平台的 TypeScript SDK 集合，采用 Monorepo 架构管理。

## 📦 包列表

### 核心层（Core Layer）

| 包 | 版本 | 描述 |
|---|---|---|
| [@sealink/core-common](./packages/core-common) | 0.1.0 | 共享类型和错误定义 |
| [@sealink/core-transport](./packages/core-transport) | 0.1.0 | HTTP 传输层 |

### 数据层（Data Layer）

| 包 | 版本 | 描述 |
|---|---|---|
| [@sealink/data-postgrest](./packages/data-postgrest) | 0.1.0 | PostgREST 客户端 |

### 运行时层（Runtime Layer）

| 包 | 版本 | 描述 |
|---|---|---|
| [@sealink/runtime-session](./packages/runtime-session) | 0.1.0 | URL Session Token 管理 |
| [@sealink/runtime-conversations](./packages/runtime-conversations) | 0.1.0 | 会话和消息管理 |

### 已有包

| 包 | 版本 | 描述 |
|---|---|---|
| [@sealink/chat](./packages/chat) | 0.1.0 | WebSocket 聊天 SDK |
| [@seaverse/account](./packages/account) | 0.1.0 | 账户服务 SDK |

## 🚀 快速开始

### 安装

```bash
# 安装依赖
pnpm install

# 构建所有包
pnpm -r build
```

### 使用示例

```typescript
import { createHttpClient } from '@sealink/core-transport';
import { DbClient } from '@sealink/data-postgrest';
import { ConversationsClient } from '@sealink/runtime-conversations';
import { getUrlSessionToken } from '@sealink/runtime-session';
import { listAppsWithConversations } from '@sealink/runtime-conversations';

// 1. 创建 HTTP 客户端
const http = createHttpClient({
  baseUrl: 'https://db.seaverse.ai',
  getAuthToken: () => localStorage.getItem('token'),
});

// 2. 创建 PostgREST 客户端
const db = new DbClient(http);

// 3. 使用会话客户端
const conversations = new ConversationsClient(db);
const list = await conversations.list({
  filter: { user_id: 'eq.123' },
  order: 'created_at.desc',
  limit: 10,
});

// 4. 使用聚合接口（替代 /api/apps/with-conversations）
const result = await listAppsWithConversations({
  db,
  getUrlSessionToken,
  accessToken: 'user-token',
  authBaseUrl: 'https://auth.sg.seaverse.dev',
});

console.log('URL Session Token:', result.url_session_token);
console.log('Apps:', result.apps);
```

## 🏗️ 架构设计

### 依赖关系

```
runtime-conversations
      ↓
data-postgrest + runtime-session
      ↓
core-transport
      ↓
core-common
```

### 设计原则

- ✅ **Browser-only**: 所有包仅支持浏览器环境
- ✅ **无数据转换**: 保持后端 snake_case 格式
- ✅ **显式注入**: 通过 TokenProvider 注入 token，不读取 Cookie/localStorage
- ✅ **PostgREST 标准**: 完全遵循 PostgREST API 规范
- ✅ **分层架构**: 严格的层级依赖，避免循环引用

## 📚 文档

- [设计文档](./docs/plans/2026-01-28-runtime-sdk-refactor-design-with-builder-sdk.md)
- [PostgREST API 参考](https://postgrest.org/en/stable/api.html)

## 🛠️ 开发

```bash
# 安装依赖
pnpm install

# 开发模式（监听文件变化）
pnpm --filter @sealink/core-common dev

# 类型检查
pnpm -r typecheck

# 清理构建产物
pnpm -r clean
```

## 📄 许可证

MIT

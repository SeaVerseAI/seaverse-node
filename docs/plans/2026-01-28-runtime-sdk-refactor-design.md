# 2026-01-28 Runtime SDK 重构规划（browser-safe）

> 目标：将 `runtime-plugins` 中“可纯 HTTP/DB 调用”的能力下沉到本仓库 SDK（客户端可直接使用），把“文件/构建/注入/沙箱交互”等 Node-only 能力暂时继续留在沙箱与 `runtime-plugins`，后续再以 API 方式对外调用。
>
> 约束：本阶段 SDK **只面向浏览器（browser）**，不引入 `fs` / `child_process` / Vite 注入 / 打包等能力；不依赖 `process.env`（改为显式配置）。

---

## 1. 背景与痛点（Why）

`runtime-plugins` 里有一部分逻辑直接与沙箱交互（启动、构建、注入、文件系统等），导致客户端使用 `runtime-plugins` 的接口时必须等待沙箱拉起才可用，出现：

- 客户端可用性被沙箱启动时机绑死（cold start）
- 能力边界不清：纯 HTTP/DB 能力也被沙箱“顺带”承载
- 依赖不合理：浏览器侧被迫间接依赖 Node-only 能力

本次重构将能力按“可在浏览器直接调用”与“必须在沙箱/Node 执行”拆开。

---

## 2. 目标（What）

### 2.1 本阶段必须达成

- 客户端（browser）可直接调用：
  - PostgREST 数据访问（CRUD + filter/select/order/limit/offset）
  - Asset Hub / Marketplace HTTP 能力（从 `runtime-plugins/shared/marketplace` 下沉）
  - Conversations / Skills / Apps 的“纯 DB + 纯 HTTP”业务能力（不含文件/构建）
- 新 SDK 能力按模块拆分为多个包，具备清晰依赖方向与可演进性

### 2.2 本阶段明确不做（暂缓）

- 任何文件系统相关能力（上传/读取/打包/注入/构建）
- 沙箱启动、沙箱 reload、Vite 插件注入、HTML 注入、压缩打包等 Node-only 工具链
- PostgREST 链式 Query Builder（可作为后续可选层；当前坚持简洁 DbClient）

---

## 3. 新包体系（Package Taxonomy）

命名遵循你提出的三层体系：

  @sealink/{category}-{service}

本次落地的最小集（MVP）建议如下：

```
seaverse-node/packages/

  core-common/                  # @sealink/core-common
  core-transport/               # @sealink/core-transport
  data-postgrest/               # @sealink/data-postgrest
  runtime-assets/               # @sealink/runtime-assets
  runtime-conversations/        # @sealink/runtime-conversations
  runtime-skills/               # @sealink/runtime-skills
  runtime-apps/                 # @sealink/runtime-apps

  # existing (keep)
  chat/                         # @sealink/chat (existing)
  account/                      # @seaverse/account (existing)
```

> 注：`runtime-files` 暂不创建（能力继续留在沙箱与 `runtime-plugins`）。

---

## 4. 分层职责与依赖规则（Hard Rules）

### 4.1 依赖方向（只能向下依赖）

```
  app-*  (未来)            (本阶段不落地)
    |
  runtime-*  (browser-safe only)
    |
  data-*     (PostgREST / 数据访问)
    |
  core-*     (transport / common)
```

### 4.2 browser-safe 禁止项

`runtime-*` / `data-*` / `core-*`（本阶段）禁止：

- Node 内置：`fs` / `path` / `child_process` / `crypto`（如需随机数用 WebCrypto 或由调用方传入）
- 读环境变量：`process.env.*`
- Vite 注入、HTML 注入、打包压缩等构建期逻辑

### 4.3 导出策略（避免 barrel 影响 tree-shaking）

建议每个包提供：

- `exports` 主入口只导出最常用 API
- 其余按子路径导出（例如 `@sealink/core-transport/http`）
- 内部模块不通过 `index.ts` 全量 re-export，避免无意引入

---

## 5. 与 `runtime-plugins` 的能力映射（迁移清单）

### 5.1 下沉到 SDK（browser-safe）

```
runtime-plugins/shared/
  - types/DbClient (PostgREST)        => @sealink/data-postgrest (接口 + 实现)
  - marketplace/*                     => @sealink/runtime-assets
  - utils/auth.ts                     => @sealink/core-transport 或 runtime-*（token 相关）

runtime-plugins/conversations/
  - services + handlers 中“纯 DB”逻辑  => @sealink/runtime-conversations

runtime-plugins/skills/
  - services + handlers 中“纯 DB/HTTP” => @sealink/runtime-skills

runtime-plugins/apps/
  - services 中“纯 DB”能力             => @sealink/runtime-apps
```

### 5.2 暂留在沙箱 / `runtime-plugins`（Node-only）

```
runtime-plugins/apps/src/utils/
  - build.ts / build-inplace.ts
  - html-injector.ts / vite-plugin-injector.ts
  - smart-compressor.ts / plugin-scanner.ts
  - 任何 injections/ 目录相关能力

runtime-plugins/* 中涉及：
  - 文件读写、目录扫描、压缩打包
  - 执行命令（npm/bun/vite）
  - sandbox reload/admin 相关
```

---

## 6. 核心能力设计（API 草案）

> 本节以“简洁 DbClient”为主（你选择的 `simple` 风格），确保足够覆盖 PostgREST 的核心能力。

### 6.1 `@sealink/core-transport`（HTTP 基座）

ASCII 结构：

```
@sealink/core-transport
  |
  +-- createHttpClient(config)
      - baseUrl
      - fetch (injectable)
      - getAuthToken() (optional)
      - timeoutMs / retry (optional)
      - onRequest/onResponse hooks (optional)
```

关键点：
- fetch 可注入（浏览器默认 global fetch；后续 RN/Node 可复用）
- 统一超时与错误包装（落到 `core-common` 错误体系）

### 6.2 `@sealink/data-postgrest`（PostgREST DbClient）

接口对齐 `runtime-plugins/shared/types/DbClient`，并做“更贴近 PostgREST”的实现：

```
createDbClient({
  baseUrl: string,          // PostgREST base URL
  schema?: string,          // optional: Accept-Profile / Content-Profile
  getAuthToken?: () => string | null,
  fetch?: typeof fetch,
})

db.get(table, { filter, select, order, limit, offset })
db.getOne(table, { filter, select })
db.post(table, data, { returning, prefer })
db.patch(table, filter, data)
db.delete(table, filter)
```

约定（PostgREST 关键行为）：
- `filter` 直接接收 PostgREST 表达式：`{ app_id: "eq.xxx" }`
- `select` 直接透传：`"id,name,created_at"`
- `order` 透传：`"created_at.desc"`
- `post` 支持 `Prefer`（例如 `return=representation`）
- 支持 schema header：
  - 读：`Accept-Profile: <schema>`
  - 写：`Content-Profile: <schema>`

### 6.3 `@sealink/runtime-assets`（Asset Hub / Marketplace）

从 `runtime-plugins/shared/marketplace/client.ts` 下沉，但将 `process.env.ASSETS_SERVICE_URL` 改为显式配置：

```
createAssetsClient({
  baseUrl: string,          // assets service url
  getAuthToken: () => string | null,
  fetch?: typeof fetch,
})

assets.createAsset(params)
assets.submitAsset(params)
assets.getForkDownloadUrl(assetId)
assets.listPublicAssets(params?)
assets.searchAssets(params)
```

### 6.4 `@sealink/runtime-conversations`（纯 DB 会话能力）

目标：覆盖 `runtime-plugins/conversations` 里的基础能力（list/create/update/messages），不涉及文件。

```
createConversationsClient({ db })

conversations.list({ appId?, order? })
conversations.get(conversationId)
conversations.create({ appId?, title? })
conversations.update(conversationId, patch)
conversations.delete(conversationId)

messages.list({ conversationId, order?, limit?, offset? })
messages.add({ conversationId, role, content, ... })
messages.update(messageId, patch)
messages.delete(messageId)
```

### 6.5 `@sealink/runtime-skills` / `@sealink/runtime-apps`

同样坚持“纯 DB/HTTP”，将 Node-only 的模板复制、目录检查、rm -rf 等全部剥离：

- `runtime-apps`：仅提供 apps 元数据 CRUD（`list/get/create/update/delete`）与 `skills_json` 更新
- `runtime-skills`：仅提供 skills 的 CRUD、market list/search 的纯 HTTP/DB 部分（具体以现有表与接口为准）

---

## 7. 第一阶段交付切片（MVP 里程碑）

```
Milestone 1 (基础可用)
  - core-common: 错误/类型/工具
  - core-transport: http client
  - data-postgrest: DbClient 实现

Milestone 2 (替代 runtime-plugins 的常用能力)
  - runtime-assets: marketplace/asset hub
  - runtime-conversations: conversations + messages

Milestone 3 (扩展业务面)
  - runtime-apps: apps 元数据 CRUD（不含文件/构建）
  - runtime-skills: skills CRUD（不含文件/构建）
```

---

## 8. 兼容与迁移策略（从旧到新）

### 8.1 “先兼容再收敛”的导入策略

- 新能力以 `@sealink/runtime-*` 为主
- `@seaverse/account` / `@sealink/chat` 暂不强行改名（避免大范围破坏）
- 后续如需统一命名空间，可通过：
  - 新包 `@sealink/account` 作为薄别名（re-export）或发布迁移文档

### 8.2 客户端切换方式（示意）

旧（依赖沙箱/插件 runtime）：
  - client -> runtime-plugins -> sandbox -> db/assets

新（直接 SDK）：
  - client -> @sealink/data-postgrest + @sealink/runtime-assets + @sealink/runtime-conversations -> db/assets/auth

---

## 9. 风险与对策（简表）

```
风险: PostgREST 过滤/排序语法差异导致兼容问题
对策: DbClient 不做“智能解析”，严格透传 PostgREST 语法；加最小单测用例（eq/like/in/order/limit/offset）

风险: 浏览器环境的 CORS/鉴权 header 限制
对策: 统一在 core-transport 注入 token；错误中包含 request-id 与可观测信息

风险: runtime-plugins 中混杂了大量 Node-only 逻辑，迁移时容易误引入
对策: runtime-* 包内写明 browser-safe lint 规则（后续可加 bundler/tsconfig 条件导出）
```


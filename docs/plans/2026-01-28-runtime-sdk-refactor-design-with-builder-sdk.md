# 2026-01-28 Runtime SDK 重构规划（结合 builder-sdk 真实用法）

> 本文档是在 `docs/plans/2026-01-28-runtime-sdk-refactor-design.md` 的基础上，结合 `/Users/mac328/Desktop/work/builder-sdk`（真实客户端 Builder）当前的调用链、模型与兼容逻辑，重新校准 SDK 的包边界与优先级。
>
> 核心原则：先对齐真实客户端的“使用方式”和“数据/协议契约”，再做分层与模块拆分。

---

## 0. 范围与明确约束

### 0.1 当前确定的产品决策

- **文件操作能力暂时继续放在沙箱/`runtime-plugins`**，后续再考虑通过 API 对外调用。

### 0.2 本阶段 SDK 的目标运行环境

- **browser only**（可被 React/Vue/原生 Web 使用）
- 禁止引入 Node-only 能力（`fs`/`child_process`/Vite 注入/构建等）
- 禁止读取 `process.env`（全部通过显式配置注入）

---

## 1. builder-sdk 的“真实使用方式”总结（事实，不是设想）

### 1.1 入口形态：组件 + 内置 API 层 + bridge

`builder-sdk`（`@sv-builder/builder`）是 UI 组件包，但内部带了调用后端的 API 层：

```
Builder (UI)
  |
  +-- initAlova(baseServer)  (HTTP 客户端初始化)
  |     - baseURL = baseServer
  |     - beforeRequest: 从 Cookie(_sv_token) 取 token，自动加 Authorization: Bearer
  |     - responded: JSON 统一错误处理（toast + throw）
  |
  +-- appApi / conversationApi / skillApi / assetApi / sandboxApi
        - 直接调用 baseServer 上的 /api/* 路由

Preview (UI)
  |
  +-- IframeHostBridge (host端) / ParentBridge (iframe端)
        - iframe 通过 postMessage 请求 host 代理调用 API
        - host 自动注入 token，并处理 TOKEN_EXPIRED、GET_API_ASSET_TOKEN 等
```

### 1.2 关键配置（BuilderProps 的真实契约）

来自 `sv-packages/builder/src/components/Builder/types.ts`：

- `token: string`
- `baseServer: string`              (Builder 后端 API server)
- `utilsServer: string`             (工具服务；通过 `@seaverse/utils-sdk` 初始化 UtilsClient)
- `previewConfig.url: string`       (带 `{id}` 占位符的预览 URL 模板)
- `previewConfig.enableSubdomain?: boolean`
- `speechTokenUrl?: string`         (语音 token API，默认 `https://auth.sg.seaverse.dev`)

### 1.3 builder-sdk 依赖的后端契约（最核心）

来自 `builder-sdk/docs/API-REFERENCE.md` 与 `sv-packages/builder/src/service/apis/*`：

#### Conversations：强依赖 `url_session_token`

- `GET /api/apps/with-conversations`
  - 返回：`apps[]` + `url_session_token`
  - 前端将 `conversation_id/app_id/created_at/updated_at` 映射到 camelCase Model
  - **关键**：每个会话对象携带 `url_session_token`，用于子域名预览场景

#### Apps / Skills / Assets：大量“沙箱路由”

builder 目前调用的 endpoint 大致分两类：

1) **可下沉到 SDK（纯 DB/纯 HTTP）**：
- `/api/apps`（create/update 元数据）
- `/api/conversations/*`（create/update/delete/messages）
- `/api/apps/:id/skills`（绑定技能，落 DB）
- marketplace list/search（未来可替换为直连 AssetHub/Marketplace）

2) **明确留在沙箱（文件/构建/同步）**：
- `/api/apps/:appId/files*`（文件树/读写/下载 zip）
- `/api/plugins/app-sync/*`（本地 list/delete/fork/publish 等“本地文件系统/构建”相关）
- `/api/plugins/skill-sync/*` 中的 upload/delete（本地技能目录/文件相关）
- `/sandbox/status`（沙箱状态）
- `/api/assets/upload`（上传文件，后端返回 HTML；本质仍是文件/资源存储链路）

#### 非常“现实”的兼容细节（必须纳入 SDK 设计）

- **字段映射**：snake_case → camelCase（例如 `conversation_id` → `id`）
- **时间单位混用**：后端有秒时间戳与 ISO 字符串，前端期望毫秒/秒不一，靠转换层兜底
- **资产上传返回 HTML**：`assetApi.upload` 需要 `DOMParser` 从 HTML 提取 `data-file-info`
- **ZIP 下载返回 base64 文本**：`appApi.downloadZipFile` 需要 `atob` 解码为 `Blob`
- **token 注入策略**：
  - Builder：把 token 写入 Cookie `_sv_token`，alova beforeRequest 自动注入
  - preview host bridge：优先用回调 `getToken()`，否则读 cookie/localStorage

---

## 2. 从真实用法反推：新 SDK 必须满足什么（Requirements）

### 2.1 必须提供的“头less SDK 能力”（给 UI/业务复用）

目标：把 builder-sdk 里“API 调用 + 数据转换 + 兼容细节”下沉到本仓库的 headless SDK，
让 builder（UI）只做 UI/交互，避免重复实现。

必须能力列表：

```
R1: 统一 HTTP 客户端（fetch adapter，tokenProvider，timeout，错误体系）
R2: 统一模型转换层（snake_case -> camelCase，时间单位规范）
R3: 会话/应用聚合查询（Apps + Conversations + url_session_token）
R4: PostgREST DbClient（simple 风格）作为数据访问底座
R5: 资产/文件的“沙箱 API 调用壳子”暂保留（但从 UI 中剥离）
R6: 预览子域名/URL 构建规则与 url_session_token 获取逻辑
```

### 2.2 “不等沙箱即可用”的关键点

builder 当前 `GET /api/apps/with-conversations` 依赖沙箱插件路由。
要解除依赖，需要 SDK 直接并行拿到：

- apps / conversations：**直连 PostgREST**
- url_session_token：**直连 auth service**

并把返回结构做成 builder 期望的模型。

---

## 3. 修订后的包规划（面向真实客户端的最小闭环）

> 这里采用你提出的命名体系：`@sealink/{category}-{service}`。
> 注意：本仓库当前已有 `@sealink/chat`（WS SDK）与 `@seaverse/account`（OpenAPI 生成 SDK）。本规划不强行改名，但新增包统一用 `@sealink/*`。

### 3.1 MVP 包（优先落地）

```
seaverse-node/packages/

  core-common/                   # @sealink/core-common
    - errors: 统一错误码/错误类（网络/鉴权/超时/协议）
    - types: tokenProvider/http hooks 等基础类型

  core-transport/                # @sealink/core-transport
    - createHttpClient({ baseUrl, fetch, getAuthToken, timeoutMs, onRequest, onResponse })
    - 纯浏览器可用，不依赖 cookie/localStorage（由上层注入 tokenProvider）

  core-transform/                # @sealink/core-transform  (新增：从 builder 反推出来的刚需)
    - snake_to_camel 转换（仅对已知模型，避免“全对象递归”带来性能/语义风险）
    - timestamp normalize（秒<->毫秒、ISO->ms）
    - upload HTML parser（DOMParser -> UploadResponse）
    - base64 zip -> Blob

  data-postgrest/                # @sealink/data-postgrest
    - DbClient(simple): get/getOne/post/patch/delete
    - PostgREST headers (Prefer/Accept-Profile/Content-Profile)

  runtime-session/               # @sealink/runtime-session  (新增：把 url_session_token 抽为明确模块)
    - getUrlSessionToken({ authBaseUrl, accessToken, fetch })  (从 runtime-plugins/shared/utils/auth.ts 浏览器化)

  runtime-conversations/         # @sealink/runtime-conversations
    - list/create/update/delete
    - messages list/add/update/delete
    - 聚合接口：listAppsWithConversations() (并行拿 db + url_session_token)

  runtime-apps/                  # @sealink/runtime-apps
    - apps 元数据 CRUD（直 PostgREST）
    - updateAppSkills（直 PostgREST）
    - 预留：file APIs 只做 “sandboxClient 壳子”，不做本地文件逻辑

  runtime-assets/                # @sealink/runtime-assets
    - 分两块导出（避免概念混淆）：
        1) marketplace/assethub（纯 HTTP，可下沉）
        2) sandbox-assets（上传/列表/下载：仍依赖沙箱 API）
```

### 3.2 依赖关系图（ASCII）

```
  (UI layer - external repo)
  builder-sdk (@sv-builder/*)
        |
        |  uses headless clients + transformers
        v
  runtime-*  --------------------->  (optional) sandbox-* clients
        |
        v
  data-postgrest  +  runtime-session
        |
        v
  core-transport  +  core-common  +  core-transform
```

---

## 4. 关键接口设计（对齐 builder 的“真实模型”）

### 4.1 Token 注入：不再隐式读 Cookie

builder 现状是 “写 cookie → alova beforeRequest 读 cookie”。
SDK 侧建议统一为显式 tokenProvider：

```
type TokenProvider = () => string | null;

createRuntimeClient({
  postgrestUrl,
  authUrl,
  sandboxBaseUrl?,       // 文件/上传/沙箱状态等，optional
  getAccessToken: TokenProvider,
  fetch?: typeof fetch,
})
```

> UI（builder）要用 cookie 也可以：在 builder 里实现 `getAccessToken()` 读取 cookie/localStorage。
> 但 SDK 不强耦合存储介质。

### 4.2 Apps + Conversations 聚合接口（替代 `/api/apps/with-conversations`）

目标返回结构对齐 `builder` 目前消费的 “会话模型 + url_session_token”：

```
listAppsWithConversations({
  appId?: string,
}) => Promise<{
  urlSessionToken: string | null,
  apps: Array<{
    app: { id, name, ... }   // 以 builder 期望为准（camelCase）
    conversations: Array<{
      id,
      title,
      appId,
      createdAt,
      lastActiveAt,
      urlSessionToken,
    }>
  }>
  globalConversations: Conversation[]   // 如 builder 需要
}>
```

实现策略（避免瀑布流）：

```
appsPromise = db.get('apps', ...)
convsPromise = db.get('conversations', ...)
urlTokenPromise = getUrlSessionToken(...)

[apps, convs, urlToken] = await Promise.all([...])
```

### 4.3 兼容转换能力（从 builder 内部下沉）

必须沉淀为可复用工具（避免每个 UI 项目重复写）：

- `transformConversation(backendConv, urlToken)`
- `parseUploadResponse(html)`（HTML → UploadResponse）
- `normalizeAssetListResponse(...)`
- `decodeBase64ZipToBlob(base64Text)`（ZIP 下载）

---

## 5. 与现有 `seaverse-node` SDK 的对齐点

### 5.1 已有包的事实

- `@seaverse/account`：OpenAPI 生成的 fetch client（偏“账户域”）
- `@sealink/chat`：WebSocket chat SDK（偏“通信域”）

### 5.2 新 runtime SDK 与之关系

新 `runtime-*` 是 “Builder / Runtime 数据与业务能力” 的 headless SDK，与 UI 包解耦：

```
@sv-builder/builder (UI)  <-- depends on -->  @sealink/runtime-*
@sv-builder/chat    (UI)  <-- optionally depends on -->  @sealink/runtime-*
@sv-builder/preview (UI)  <-- optionally uses --> @sealink/core-transport (for API proxy)
```

---

## 6. 分阶段落地计划（以 builder 真实痛点为优先级）

```
Phase 0 (文档/契约对齐)
  - 明确 builder 需要的模型（Conversation.Model / App.LocalModel 等）
  - 明确哪些接口必须保持向后兼容（字段、时间单位、url_session_token）

Phase 1 (不等沙箱即可获取列表)
  - core-common / core-transport / core-transform
  - data-postgrest (DbClient simple)
  - runtime-session (getUrlSessionToken)
  - runtime-conversations: 实现 listAppsWithConversations（直 PostgREST + auth 并行）

Phase 2 (替换更多 /api 路由)
  - runtime-apps: apps CRUD（直 PostgREST）
  - runtime-skills: skills CRUD + updateAppSkills（直 PostgREST）
  - runtime-assets: marketplace/assethub（直 HTTP）

Phase 3 (沙箱能力仅保留壳子)
  - sandbox-files / sandbox-assets / sandbox-status client（只做调用封装，不做文件系统）
  - builder 侧按需调用（沙箱没起来时 UI 能优雅降级）
```

---

## 7. 风险与注意事项（builder 真实场景）

```
风险: builder 目前依赖 /api/apps/with-conversations 的聚合结构
对策: runtime-conversations 提供等价聚合函数，返回结构对齐 builder Model

风险: url_session_token 的获取依赖 auth service
对策: runtime-session 单独模块，允许返回 null；UI 根据 null 走非子域名模式

风险: 资产上传/文件下载是“文件链路”，仍需沙箱
对策: sandbox-* client 作为 optional；不阻塞 apps/conversations/skills 的直连能力
```


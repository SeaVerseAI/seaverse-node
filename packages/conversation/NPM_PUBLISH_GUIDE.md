# NPM 发布指南

## 一次性设置（长久有效）

### 1. 创建 npm Automation Token

1. 访问 https://www.npmjs.com/settings/YOUR_USERNAME/tokens
2. 点击 "Generate New Token"
3. 选择 "Automation" 类型（推荐，90天有效期但会自动续期）
4. 复制生成的 token（以 `npm_` 开头）

### 2. 配置环境变量

#### 方法 A: 添加到 ~/.zshrc 或 ~/.bashrc（推荐）

```bash
# 编辑配置文件
vim ~/.zshrc  # 或者 ~/.bashrc

# 添加以下内容
export NPM_TOKEN='npm_xxxxxxxxxxxxxxxxxxxxxxxxxx'

# 重新加载配置
source ~/.zshrc  # 或者 source ~/.bashrc
```

#### 方法 B: 直接更新 ~/.npmrc

```bash
echo "//registry.npmjs.org/:_authToken=npm_xxxxxxxxxxxxxxxxxxxxxxxxxx" > ~/.npmrc
```

### 3. 验证设置

```bash
# 测试登录状态
npm whoami

# 应该显示你的 npm 用户名
```

## 发布流程

### 使用自动化脚本（推荐）

```bash
cd /Users/mac328/Desktop/work/seaverse-node/packages/conversation

# 发布 patch 版本 (0.2.2 -> 0.2.3)
./scripts/publish.sh

# 发布 minor 版本 (0.2.2 -> 0.3.0)
./scripts/publish.sh minor

# 发布 major 版本 (0.2.2 -> 1.0.0)
./scripts/publish.sh major
```

### 手动发布

```bash
cd /Users/mac328/Desktop/work/seaverse-node/packages/conversation

# 1. 清理和构建
npm run clean
npm run build

# 2. 更新版本
npm version patch  # 或 minor / major

# 3. 发布
npm publish --access public

# 4. 推送到 git
git push && git push --tags
```

## 版本号说明

- **patch**: 修复 bug (0.2.2 -> 0.2.3)
- **minor**: 新增功能，向后兼容 (0.2.2 -> 0.3.0)
- **major**: 破坏性更新 (0.2.2 -> 1.0.0)

## 常见问题

### 1. 401 Unauthorized

```bash
# 检查 token 是否有效
npm whoami

# 重新设置 token
export NPM_TOKEN='your-new-token'
```

### 2. 404 Not Found

确保 `@seaverse` 组织存在且你有发布权限：

```bash
# 检查组织访问权限
npm org ls seaverse

# 如果组织不存在，在 npmjs.com 创建组织
```

### 3. 版本冲突

```bash
# 查看当前版本
npm view @seaverse/conversation-sdk version

# 确保本地版本大于远程版本
```

## 自动化发布（GitHub Actions）

创建 `.github/workflows/publish.yml`:

\`\`\`yaml
name: Publish to npm

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'

      - name: Install dependencies
        run: cd packages/conversation && npm ci

      - name: Build
        run: cd packages/conversation && npm run build

      - name: Publish
        run: cd packages/conversation && npm publish --access public
        env:
          NODE_AUTH_TOKEN: \${{ secrets.NPM_TOKEN }}
\`\`\`

然后在 GitHub 仓库设置中添加 `NPM_TOKEN` secret。

## 更新日志

### v0.2.2 (2026-02-03)

- ✅ 会话列表全量返回
- ✅ Apps 按创建时间倒序排序
- ✅ Conversations 按更新时间倒序排序
- ✅ 新增 `createConversation()` 方法
- ✅ 新增 `deleteConversation()` 方法
- ✅ 数据格式匹配 runtime-plugins (snake_case)

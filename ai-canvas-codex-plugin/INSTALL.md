# AI Canvas Installation Guide / AI Canvas 安装指南

This guide explains how to install AI Canvas as a Codex plugin from GitHub or from a local checkout.

这份文档说明如何从 GitHub 或本地目录安装 AI Canvas Codex 插件。

## Requirements / 环境要求

English:

- Codex with plugin support.
- Node.js 20 or newer.
- Git.
- Network access for `npx` and `pnpm` dependency installation when building from source.

中文：

- 支持插件的 Codex。
- Node.js 20 或更新版本。
- Git。
- 如果从源码构建，需要网络访问 `npx` 和 `pnpm` 依赖源。

Check Node.js / 检查 Node.js：

```bash
node --version
```

If the major version is lower than 20, install a newer Node.js first.

如果主版本号低于 20，请先升级 Node.js。

## Option A: Install From A Local Clone / 方式 A：从本地克隆安装

This is the recommended path for most GitHub users because it always builds the local runtime files before Codex loads the plugin.

这是最推荐的 GitHub 用户安装方式，因为它会先在本地构建运行时文件，再让 Codex 加载插件。

### 1. Clone / 克隆仓库

```bash
git clone https://github.com/binghe1980/AI-Canvas.git
cd AI-Canvas/ai-canvas-codex-plugin
```

This guide uses the public repository `binghe1980/AI-Canvas`.

本文档使用公开仓库 `binghe1980/AI-Canvas`。

### 2. Install dependencies and build / 安装依赖并构建

```bash
npm run setup
```

This command runs:

这个命令会执行：

```bash
npx --yes pnpm@10.13.1 install
npx --yes pnpm@10.13.1 build
```

It also checks that these required runtime files exist:

它还会检查这些运行时文件是否存在：

```text
packages/mcp-server/dist/index.js
packages/canvas-app/dist/server/server.js
```

### 3. Add this checkout as a Codex marketplace / 把本地目录添加为 Codex marketplace

Run this from the repository root:

在仓库根目录执行：

```bash
cd ..
codex plugin marketplace add .
```

This reads `.agents/plugins/marketplace.json`, whose marketplace name is:

它会读取 `.agents/plugins/marketplace.json`，其中 marketplace 名称是：

```text
ai-canvas
```

### 4. Install the plugin / 安装插件

```bash
codex plugin add ai-canvas-codex-plugin@ai-canvas
```

### 5. Restart Codex / 重启 Codex

Close and reopen Codex, or open a new chat so Codex reloads plugin skills and MCP tools.

关闭并重新打开 Codex，或新开一个对话，让 Codex 重新加载插件技能和 MCP 工具。

### 6. Verify / 验证安装

In Codex, try:

在 Codex 中输入：

```text
@AI Canvas 打开 AI 画布。
```

Expected result:

预期结果：

```text
http://127.0.0.1:43218/
```

Click the local URL in Codex and the canvas should open in the side panel.

点击 Codex 返回的本地链接，画布应该会在侧边栏打开。

## Option B: Install From A Git Marketplace / 方式 B：从 Git marketplace 安装

Use this path only when the published Git branch includes the built `ai-canvas-codex-plugin/packages/*/dist` runtime files. Codex plugin installation does not run `npm run setup` for users automatically.

只有当发布分支包含已经构建好的 `ai-canvas-codex-plugin/packages/*/dist` 运行时文件时，才建议使用这种方式。Codex 安装插件时不会自动替用户运行 `npm run setup`。

```bash
codex plugin marketplace add https://github.com/binghe1980/AI-Canvas --ref main
codex plugin add ai-canvas-codex-plugin@ai-canvas
```

Then restart Codex or open a new chat.

然后重启 Codex，或新开一个对话。

If the Git marketplace install cannot start the plugin, switch to Option A and build locally.

如果 Git marketplace 安装后插件无法启动，请改用方式 A，在本地克隆并构建。

## Updating / 更新

### Local clone / 本地克隆

```bash
git pull
cd ai-canvas-codex-plugin
npm run setup
cd ..
codex plugin add ai-canvas-codex-plugin@ai-canvas
```

Restart Codex or open a new chat after reinstalling.

重新安装后，重启 Codex 或新开对话。

### Git marketplace / Git marketplace

```bash
codex plugin marketplace upgrade ai-canvas
codex plugin add ai-canvas-codex-plugin@ai-canvas
```

Restart Codex or open a new chat after reinstalling.

重新安装后，重启 Codex 或新开对话。

## Uninstall / 卸载

Remove the installed plugin:

移除已安装插件：

```bash
codex plugin remove ai-canvas-codex-plugin
```

If you added the local or Git marketplace only for this plugin, you can also remove that marketplace from Codex:

如果你添加这个 marketplace 只是为了安装 AI Canvas，也可以从 Codex 中移除该 marketplace：

```bash
codex plugin marketplace remove ai-canvas
```

## Developer Checks / 开发者检查

```bash
npm run typecheck
npm run test
npm run validate:plugin
```

`npm run validate:plugin` performs a lightweight repository validation that works outside the original developer machine.

`npm run validate:plugin` 是一个轻量仓库校验脚本，可以在其他机器上运行，不依赖原作者本机路径。

## Manual Canvas Preview / 手动预览画布

After `npm run setup`, you can start the canvas service manually:

运行 `npm run setup` 后，可以手动启动画布服务：

```bash
NODE_ENV=production node packages/canvas-app/dist/server/server.js \
  --port 43218 \
  --workspace-root "<your workspace>"
```

Open:

打开：

```text
http://127.0.0.1:43218/
```

## Troubleshooting / 排错

### Codex cannot find AI Canvas / Codex 找不到 AI Canvas

English:

1. Confirm the plugin was installed with `codex plugin add ai-canvas-codex-plugin@ai-canvas`.
2. Fully restart Codex or open a new chat.
3. Try `@AI Canvas 打开 AI 画布。` again.

中文：

1. 确认已经执行 `codex plugin add ai-canvas-codex-plugin@ai-canvas`。
2. 完全重启 Codex，或新开一个对话。
3. 再输入 `@AI Canvas 打开 AI 画布。`。

### MCP tools are missing / MCP 工具没有加载

English:

This usually means the current chat started before the plugin was installed or updated. Restart Codex or open a new chat.

中文：

通常是因为当前对话早于插件安装或更新。请重启 Codex，或新开一个对话。

### Canvas port is busy / 画布端口被占用

English:

The default port is `43218`. Set a different port before launching Codex or the preview server:

中文：

默认端口是 `43218`。如果被占用，可以在启动 Codex 或预览服务前设置新端口：

```bash
export AI_CANVAS_PORT=43219
```

### Local data location / 本地数据位置

English:

By default, canvas data is stored under `.ai-canvas/` in the active workspace. To override it:

中文：

默认情况下，画布数据保存在当前工作区的 `.ai-canvas/` 目录。可以通过环境变量改到其他位置：

```bash
export AI_CANVAS_HOME="/path/to/ai-canvas-data"
```

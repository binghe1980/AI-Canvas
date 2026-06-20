# AI Canvas Codex Plugin

AI Canvas is a Codex plugin that gives Codex a local infinite canvas for image generation, visual annotation, and iterative image editing.

AI Canvas 是一个 Codex 插件，让 Codex 可以打开本地无限画布，生成图片，读取画布上的箭头/文字/圈选标注，并把修改后的新版本自动放到旧图右侧。

## Languages / 语言

- English: read this README and [INSTALL.md](./INSTALL.md).
- 中文：阅读本文中的中文部分，以及 [使用说明.md](./使用说明.md)、[自然语言工作流.md](./自然语言工作流.md)、[INSTALL.md](./INSTALL.md)。

## What It Does / 它能做什么

English:

- Opens a local tldraw-based canvas from Codex.
- Creates an image holder for a natural-language prompt.
- Helps Codex generate an image and insert it into the canvas.
- Reads arrows, text notes, circles, and rectangles as edit instructions.
- Creates revised image versions to the right of the original image.
- Supports a button-driven auto edit loop: annotate on the canvas, click `按标注修图`, and let Codex process the queued request.

中文：

- 从 Codex 打开一个本地 tldraw 无限画布。
- 根据自然语言需求创建图片框。
- 协助 Codex 生成图片，并插入画布。
- 读取箭头、文字、圆圈、矩形等标注作为修图指令。
- 把新版图片放到旧图右侧，保留历史版本。
- 支持按钮式自动修图：在画布标注后点击 `按标注修图`，Codex 会接收队列任务并继续处理。

## Quick Start / 快速开始

Prerequisites / 前置要求：

- Codex with plugin support / 支持插件的 Codex。
- Node.js 20 or newer / Node.js 20 或更新版本。
- Git and network access for dependency installation / Git，以及安装依赖所需的网络访问。

Clone and build / 克隆并构建：

```bash
git clone https://github.com/binghe1980/AI-Canvas.git
cd AI-Canvas/ai-canvas-codex-plugin
npm run setup
```

Install into Codex from the repository root / 从仓库根目录安装到 Codex：

```bash
cd ..
codex plugin marketplace add .
codex plugin add ai-canvas-codex-plugin@ai-canvas
```

Restart Codex or open a new chat, then try / 重启 Codex 或新建对话，然后输入：

```text
@AI Canvas 打开 AI 画布，帮我做一张拉面广告。
```

For the full installation guide, including Git marketplace installs, updates, verification, and troubleshooting, see [INSTALL.md](./INSTALL.md).

完整安装说明，包括 Git marketplace 安装、更新、验证和排错，请看 [INSTALL.md](./INSTALL.md)。

## Daily Workflow / 日常使用流程

English:

1. Ask Codex to open AI Canvas and generate an image.
2. Open the returned local canvas URL in the Codex side panel.
3. Annotate the image with arrows, text, circles, or rectangles.
4. Say `@AI Canvas 开启自动修图模式` once.
5. Click `按标注修图` on the canvas after each batch of annotations.
6. Codex creates a new version on the right and keeps the original image.

中文：

1. 在 Codex 里要求 AI Canvas 打开画布并生成图片。
2. 点击 Codex 返回的本地画布链接，在侧边栏打开。
3. 在图片上画箭头、写文字、圈出区域。
4. 第一次改图前说：`@AI Canvas 开启自动修图模式`。
5. 每批标注完成后，在画布上点击 `按标注修图`。
6. Codex 会把新版放到右侧，并保留旧图。

Useful prompts / 常用提示词：

```text
@AI Canvas 打开 AI 画布，帮我做一张小红书封面。
@AI Canvas 生成一张竖版拉面广告，品牌叫拉面一番，要高级食物摄影风格。
@AI Canvas 开启自动修图模式。
@AI Canvas 按我画布上的标注修改。
```

## Installation Models / 安装方式

This repository supports two practical installation models.

本仓库支持两种实际安装方式。

### 1. Local Clone, Build, Then Install / 本地克隆、构建后安装

This is the safest path for users who download the repository themselves.

这是最稳妥的方式，适合用户自己下载仓库后安装。

```bash
git clone https://github.com/binghe1980/AI-Canvas.git
cd AI-Canvas/ai-canvas-codex-plugin
npm run setup
cd ..
codex plugin marketplace add .
codex plugin add ai-canvas-codex-plugin@ai-canvas
```

### 2. Git Marketplace Install / Git marketplace 安装

This is convenient for public distribution after the release branch includes built runtime files under `ai-canvas-codex-plugin/packages/*/dist`.

如果发布分支已经包含 `ai-canvas-codex-plugin/packages/*/dist` 运行时构建产物，可以使用这种方式直接从 Git marketplace 安装。

```bash
codex plugin marketplace add https://github.com/binghe1980/AI-Canvas --ref main
codex plugin add ai-canvas-codex-plugin@ai-canvas
```

If the plugin fails to start after a Git marketplace install, clone the repository, run `npm run setup` inside `ai-canvas-codex-plugin/`, then install from the repository root.

如果 Git marketplace 安装后插件启动失败，请改用本地克隆方式：克隆仓库，在 `ai-canvas-codex-plugin/` 里运行 `npm run setup`，再从仓库根目录安装。

## Development / 开发

Install and build / 安装并构建：

```bash
npm run setup
```

Run checks / 运行检查：

```bash
npm run typecheck
npm run test
npm run validate:plugin
```

Preview the canvas service / 预览画布服务：

```bash
NODE_ENV=production node packages/canvas-app/dist/server/server.js \
  --port 43218 \
  --workspace-root "<your workspace>"
```

Open / 打开：

```text
http://127.0.0.1:43218/
```

## Project Structure / 项目结构

```text
.codex-plugin/plugin.json       Codex plugin manifest
.agents/plugins/marketplace.json Git/Codex marketplace entry at the repository root
.mcp.json                       MCP server configuration
skills/                         Codex natural-language workflow skills
packages/shared/                Shared schemas, types, and annotation parsing
packages/canvas-app/            React + Vite + tldraw canvas service
packages/mcp-server/            MCP tools used by Codex
scripts/setup.mjs               Dependency install and build helper
scripts/validate-plugin.mjs     Lightweight release validation
```

## Local Data And Privacy / 本地数据与隐私

English:

- The canvas service runs locally on `127.0.0.1`, default port `43218`.
- Canvas data is stored in `.ai-canvas/` under the active workspace unless `AI_CANVAS_HOME` is set.
- Generated and edited images are copied into the local canvas asset directory.
- `.ai-canvas/`, `tmp/`, `node_modules/`, and TypeScript build info files are ignored by Git.

中文：

- 画布服务运行在本机 `127.0.0.1`，默认端口是 `43218`。
- 画布数据默认保存在当前工作区的 `.ai-canvas/` 目录，除非设置了 `AI_CANVAS_HOME`。
- 生成图和修图结果会复制到本地画布资源目录。
- `.ai-canvas/`、`tmp/`、`node_modules/` 和 TypeScript 构建缓存不会提交到 Git。

## Troubleshooting / 常见问题

English:

- Codex cannot find AI Canvas: restart Codex or open a new chat after installing the plugin.
- MCP tools are missing: reinstall the plugin with `codex plugin add ai-canvas-codex-plugin@ai-canvas`.
- Canvas does not open: check whether port `43218` is already used, or set `AI_CANVAS_PORT`.
- Image edits do not start: say `@AI Canvas 开启自动修图模式`, then click `按标注修图` on the canvas.

中文：

- Codex 找不到 AI Canvas：安装后重启 Codex，或新开一个对话。
- MCP 工具没有加载：重新运行 `codex plugin add ai-canvas-codex-plugin@ai-canvas`。
- 画布打不开：检查 `43218` 端口是否被占用，或设置 `AI_CANVAS_PORT`。
- 点按钮后没有修图：先说 `@AI Canvas 开启自动修图模式`，再在画布点击 `按标注修图`。

## License / 许可证

MIT. See [LICENSE](./LICENSE).

<div align="center">

# AI Canvas Codex Plugin

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../LICENSE)
[![Codex Plugin](https://img.shields.io/badge/Codex-Plugin-111827)](./.codex-plugin/plugin.json)
[![MCP](https://img.shields.io/badge/MCP-Tools-2563eb)](./.mcp.json)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933)](./package.json)
[![lang](https://img.shields.io/badge/lang-中文-dc2626)](./使用说明.md)
[![lang](https://img.shields.io/badge/lang-English-0284c7)](./README.md)

[Install](./INSTALL.md) · [User Guide](./使用说明.md) · [Workflow](./自然语言工作流.md)

</div>

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
- Supports executable canvas Skills from the right-side Skill panel: `小红书封面`, `YouTube 封面图`, `一键跨平台适配`, `产品营销组图`, `Logo 与品牌`, and `营销宣传册`.
- Skill results are generated as final designed raster images and placed back on the canvas for side-by-side comparison.

中文：

- 从 Codex 打开一个本地 tldraw 无限画布。
- 根据自然语言需求创建图片框。
- 协助 Codex 生成图片，并插入画布。
- 读取箭头、文字、圆圈、矩形等标注作为修图指令。
- 把新版图片放到旧图右侧，保留历史版本。
- 支持按钮式自动修图：在画布标注后点击 `按标注修图`，Codex 会接收队列任务并继续处理。
- 支持右侧 Skill 面板里的真实生成闭环：`小红书封面`、`YouTube 封面图`、`一键跨平台适配`、`产品营销组图`、`Logo 与品牌`、`营销宣传册`。
- Skill 结果会作为完整设计成品图生成，并自动放回画布，方便和原图横向对比。

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

For canvas Skills, say `@AI Canvas 继续处理画布里的 Skill 请求`, then select an image when the Skill requires one, choose a Skill from the canvas Skill panel, fill in the fields, and click `提交给 Codex 生成`. Codex processes the queued Skill request and places the generated result to the right of the source image.

中文：

1. 在 Codex 里要求 AI Canvas 打开画布并生成图片。
2. 点击 Codex 返回的本地画布链接，在侧边栏打开。
3. 在图片上画箭头、写文字、圈出区域。
4. 第一次改图前说：`@AI Canvas 开启自动修图模式`。
5. 每批标注完成后，在画布上点击 `按标注修图`。
6. Codex 会把新版放到右侧，并保留旧图。

Skill 面板：先说 `@AI Canvas 继续处理画布里的 Skill 请求`，再根据需要选中图片，打开画布 Skill 面板，选择 Skill，填写参数并点击 `提交给 Codex 生成`。Codex 会处理队列任务，并把生成结果放到原图右侧。

## Built-in Skills / 内置 Skill

| Category / 分类 | Skill | Output / 输出 |
| --- | --- | --- |
| Social Media | 小红书封面 | 3:4 成品封面图，包含字体、配色、版式和标题。 |
| Social Media | YouTube 封面图 | 16:9 高识别度缩略图。 |
| Studio | 一键跨平台适配 | 按小红书、Instagram、Story/Reels、公众号、推特、LinkedIn 等比例重构图片。 |
| E Commerce | 产品营销组图 | 产品主图、卖点图、场景图、细节图等电商物料。 |
| Branding | Logo 与品牌 | Logo 概念、备选方向、品牌视觉板和应用预览。 |
| Marketing | 营销宣传册 | 三折页、服务介绍册、活动推广册或产品推广册。 |

Useful prompts / 常用提示词：

```text
@AI Canvas 打开 AI 画布，帮我做一张小红书封面。
@AI Canvas 生成一张竖版拉面广告，品牌叫拉面一番，要高级食物摄影风格。
@AI Canvas 开启自动修图模式。
@AI Canvas 按我画布上的标注修改。
@AI Canvas 继续处理画布里的 Skill 请求。
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

<div align="center">

# AI Canvas

### An AI infinite canvas for Codex: generate images, annotate visually, and create revised versions.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Codex Plugin](https://img.shields.io/badge/Codex-Plugin-111827)](#install)
[![MCP](https://img.shields.io/badge/MCP-Tools-2563eb)](./ai-canvas-codex-plugin/.mcp.json)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933)](./ai-canvas-codex-plugin/package.json)
[![pnpm](https://img.shields.io/badge/pnpm-10.13.1-f69220)](./ai-canvas-codex-plugin/package.json)
[![中文](https://img.shields.io/badge/lang-中文-dc2626)](./README.md)
[![English](https://img.shields.io/badge/lang-English-0284c7)](./README.en.md)

[中文](./README.md) · **English**

[Install](#install) · [Interface Preview](#interface-preview) · [Workflow](#workflow) · [Use Cases](#use-cases) · [Docs](#docs) · [Privacy](#privacy)

</div>

---

## What Is AI Canvas?

AI Canvas is a Codex plugin marketplace that adds a local infinite canvas for image generation, visual annotation, and iterative image editing.

Think of it as:

```text
An AI drawing whiteboard inside Codex.
```

Users do not need to understand MCP tools, holder IDs, run metadata, or local file paths. Ask for an image, open the canvas, annotate changes, and click the edit button.

## Interface Preview

<div align="center">
  <img src="./assets/ai-canvas-interface-preview.png" alt="AI Canvas interface preview showing Codex conversation and the local canvas working together" width="100%">
</div>

## Highlights

| Capability | What It Does |
| --- | --- |
| Natural prompt to image | Ask Codex for an ad, cover, poster, product image, or visual concept. |
| Local infinite canvas | Open a local tldraw-based canvas for annotation and side-by-side version comparison. |
| Visual annotation editing | Arrows, text, circles, and rectangles become edit instructions. |
| Versioned iteration | New edited images are placed to the right; originals stay unchanged. |
| Codex plugin workflow | MCP tools and Codex skills are bundled so users can work in natural language. |

## Install

### Recommended: Install Directly From GitHub

```bash
codex plugin marketplace add https://github.com/binghe1980/AI-Canvas --ref main
codex plugin add ai-canvas-codex-plugin@ai-canvas
```

Restart Codex or open a new chat, then try:

```text
@AI Canvas 打开 AI 画布，帮我做一张拉面广告。
```

### Local Development Install

```bash
git clone https://github.com/binghe1980/AI-Canvas.git
cd AI-Canvas/ai-canvas-codex-plugin
npm run setup
cd ..
codex plugin marketplace add .
codex plugin add ai-canvas-codex-plugin@ai-canvas
```

Full installation, update, and troubleshooting guide:

- [INSTALL.md](./ai-canvas-codex-plugin/INSTALL.md)

## Workflow

```mermaid
flowchart LR
  A["User asks Codex<br/>Generate an ad image"] --> B["AI Canvas opens<br/>local canvas"]
  B --> C["Codex creates holder<br/>and generates image"]
  C --> D["Image inserted<br/>into canvas"]
  D --> E["User annotates<br/>arrows + text + circles"]
  E --> F["Click 按标注修图"]
  F --> G["Codex reads annotations<br/>and edits image"]
  G --> H["New version placed<br/>to the right"]
  H --> E
```

Daily use in one minute:

1. Tell Codex what image you want.
2. Open the returned local canvas link.
3. Mark changes on the image with arrows, text, circles, or rectangles.
4. Say `@AI Canvas 开启自动修图模式`.
5. Click `按标注修图` on the canvas after each batch of annotations.
6. Compare the original and new version side by side, then keep iterating.

## Example Prompts

```text
@AI Canvas 打开 AI 画布，帮我做一张小红书封面。

@AI Canvas 生成一张竖版拉面广告，品牌叫拉面一番，要高级食物摄影风格。

@AI Canvas 开启自动修图模式。

@AI Canvas 按我画布上的标注修改。
```

## Use Cases

| Scenario | What AI Canvas Helps With |
| --- | --- |
| Social covers | Xiaohongshu covers, short-video covers, campaign posters |
| Ads and banners | Food ads, product ads, campaign banners, hero visuals |
| Product concepts | Moodboards, packaging directions, visual drafts, hero images |
| Iterative editing | Mark one region, generate a new version, keep the old image for comparison |
| Design review | Use the canvas as a visual discussion surface inside Codex |

## Docs

- [Plugin README](./ai-canvas-codex-plugin/README.md)
- [Installation Guide](./ai-canvas-codex-plugin/INSTALL.md)
- [Chinese User Guide](./ai-canvas-codex-plugin/使用说明.md)
- [Natural-Language Workflow](./ai-canvas-codex-plugin/自然语言工作流.md)
- [中文 README](./README.md)

## Repository Layout

```text
.agents/plugins/marketplace.json
ai-canvas-codex-plugin/
  .codex-plugin/plugin.json
  .mcp.json
  skills/
  packages/
    canvas-app/
    mcp-server/
    shared/
```

Codex reads `.agents/plugins/marketplace.json` from this repository root. The marketplace points to `./ai-canvas-codex-plugin`.

## Privacy

- The canvas service runs locally on `127.0.0.1`, default port `43218`.
- Canvas state and generated assets are stored locally under `.ai-canvas/` in the active workspace unless `AI_CANVAS_HOME` is set.
- Local runtime data, temporary QA data, dependency folders, logs, and environment files are ignored by Git.
- The plugin does not include a hosted backend. It is a local Codex plugin workflow.

## Development

```bash
cd ai-canvas-codex-plugin
npm run setup
npm run typecheck
npm run test
npm run validate:plugin
```

Manual preview:

```bash
NODE_ENV=production node packages/canvas-app/dist/server/server.js \
  --port 43218 \
  --workspace-root "<your workspace>"
```

Open:

```text
http://127.0.0.1:43218/
```

## License

MIT. See [LICENSE](./LICENSE).

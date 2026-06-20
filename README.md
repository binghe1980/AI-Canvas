# AI Canvas Codex Plugin

This repository packages AI Canvas as a Codex plugin marketplace. The actual plugin lives in [`ai-canvas-codex-plugin/`](./ai-canvas-codex-plugin/).

本仓库把 AI Canvas 打包成一个 Codex 插件 marketplace。实际插件代码在 [`ai-canvas-codex-plugin/`](./ai-canvas-codex-plugin/)。

## Quick Install / 快速安装

Clone and build:

克隆并构建：

```bash
git clone https://github.com/binghe1980/AI-Canvas.git
cd AI-Canvas/ai-canvas-codex-plugin
npm run setup
```

Install from the repository root:

从仓库根目录安装：

```bash
cd ..
codex plugin marketplace add .
codex plugin add ai-canvas-codex-plugin@ai-canvas
```

Restart Codex or open a new chat, then try:

重启 Codex 或新建对话，然后输入：

```text
@AI Canvas 打开 AI 画布，帮我做一张拉面广告。
```

## Documentation / 文档

- [Plugin README](./ai-canvas-codex-plugin/README.md)
- [Installation Guide / 安装指南](./ai-canvas-codex-plugin/INSTALL.md)
- [中文小白使用说明](./ai-canvas-codex-plugin/使用说明.md)
- [自然语言工作流](./ai-canvas-codex-plugin/自然语言工作流.md)

## Marketplace Layout / Marketplace 结构

```text
.agents/plugins/marketplace.json
ai-canvas-codex-plugin/
  .codex-plugin/plugin.json
  .mcp.json
  skills/
  packages/
```

Codex reads `.agents/plugins/marketplace.json` from this repository root. That marketplace points to `./ai-canvas-codex-plugin`.

Codex 会从仓库根目录读取 `.agents/plugins/marketplace.json`，其中插件路径指向 `./ai-canvas-codex-plugin`。

## License / 许可证

MIT. See [LICENSE](./LICENSE).

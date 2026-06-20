---
name: fill-ai-image-holder
description: "Use when the user asks AI Canvas to generate, create, fill, or design an image into the current canvas holder, including phrases like 填充图片框, 生成广告图, 做一张海报, or Fill AI Image Holder."
---

# Fill AI Image Holder

Use this skill for the first image-generation loop in AI Canvas. The user should be able to say a normal request, not tool names.

## Tool Availability Gate

This workflow must use the AI Canvas MCP tools. If `prepare_image_generation`, `insert_image_into_holder`, or `save_snapshot` are not callable in the current Codex thread, stop and tell the user:

```text
AI Canvas 插件已经识别到，但工具没有加载出来。如果你刚安装或刚更新过插件，请完全退出并重新打开 Codex，再发送同一句需求；插件不需要重新安装。
```

Do not inspect plugin files, run `curl`, check ports, start local services by hand, or recreate HTTP calls during a normal image-generation request. Those actions are only for explicit plugin development/debugging.

## Workflow

1. Call `prepare_image_generation` with the user's original request.
2. Choose an aspect ratio when missing:
   - 横版广告, banner, 封面头图: `16:9`.
   - 小红书封面, 竖版广告, poster: `5:7`.
   - 头像, 方图, product square: `1:1`.
   - Unknown: `5:7`.
3. If the returned result includes a canvas URL, show it as a clickable link. Do not open external Chrome, headless Chrome, shell `open`, or Browser automation to connect the canvas.
4. Generate the image using the available Codex image-generation capability and the returned `suggestedPrompt`. If the user asked for text, typography, title design, poster lettering, or brand words, let image 2.0 design those directly in the image.
5. Do not create a separate local text overlay, Python/PIL composition, second layout pass, or alternate final image unless the user explicitly asks for it or the image tool did not produce a usable local image.
6. Save the generated image under the returned output directory when the image tool provides a file or downloadable result.
7. Call `insert_image_into_holder` with the holder id and local image path.
8. Call `save_snapshot`.
9. Tell the user the image is inserted, then clearly hand off to canvas work: "现在请打开画布标注，标完一批后点“按标注修图”。我会在这里等按钮，不是还在生成。"
10. Continue with the `auto-ai-canvas-edit-mode` workflow by polling `watch_edit_requests` until the user says to stop, the Codex app/thread is closed, the task is interrupted, or a blocking clarification is required.

## User-Facing Tone

Say what is happening like a product assistant:

- "我先确认画布里的图片框。"
- "我会生成图片并放进当前图片框。"
- "图片已经放进画布。现在请去画布上画箭头和文字，标完一批后点“按标注修图”。"
- "我会继续等你点“按标注修图”，这不是卡住，也不是还在生成。"

Do not expose MCP JSON, shape IDs, or file paths unless the user asks for debugging details.

## Canvas Opening Rule

Do not launch an external browser window, hidden Chrome, headless Chrome, shell `open`, or Browser automation. Show the returned local URL as a clickable link and let the user open it inside Codex's side panel. Browser automation is for testing only.

If the canvas page is not open, keep the generation flow simple: generate the image, save it, insert it through the AI Canvas service, and let the service queue the visual update until the user opens the canvas.

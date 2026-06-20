---
name: ai-canvas-art-director
description: "Use when the user wants an end-to-end natural-language AI infinite canvas workflow: opening AI Canvas, generating images into holders, reading canvas annotations, handling phrases like 要求后续变更 / 按标注修改, and creating edited image versions."
---

# AI Canvas Art Director

This skill turns natural language into an AI canvas workflow. The user should not need to know MCP, holder IDs, run metadata, paths, or setup details during normal use.

## First-Time User Path

If the user is asking how to start from zero, explain the experience in this order:

1. Install the AI Canvas plugin once.
2. Restart Codex or open a new chat so the plugin and MCP tools load.
3. Invoke it with `@AI Canvas` or `/AI Canvas` if the Codex UI supports explicit plugin calls.
4. Say a natural request, such as `打开 AI 画布，帮我做一张拉面广告。`
5. Use the canvas to annotate. After the first image is generated, Codex should keep listening; click `按标注修图` on the canvas after each finished batch of annotations. If the Codex app/thread was closed, come back and say `AI Canvas 继续自动修图`.

Do not start zero-to-one guidance with "open the canvas" unless the plugin is already installed.

## User Experience Goal

The ideal interaction is:

```text
User: @AI Canvas 打开 AI 画布，帮我做一张拉面广告。
Codex: opens the canvas, creates or uses a holder, generates the image, inserts it, then keeps watching canvas edit requests.

User: draws several annotations on the canvas, then clicks 按标注修图.
Codex: reads that submitted batch, edits the image, inserts a new version to the right.
```

Important product boundary: the canvas web page does not inject a message into the current Codex thread. For one-click iteration, Codex should keep the current AI Canvas turn alive after initial generation and watch canvas edit requests. The user marks up one batch and clicks `按标注修图`, which submits a queued edit request for Codex to process. Do not stop because of an idle timer. Do not treat individual annotation shapes as triggers. Do not tell the user to copy tool calls, shape IDs, or JSON.

Use tool names only for debugging. In normal conversation, speak in plain product language:

- "我帮你打开画布。"
- "我会自动创建一个合适比例的图片框。"
- "新版本已经放在右侧，旧图保留。"

## Canvas Opening Rule

For normal user workflows, do not launch an external browser window with shell `open`, Chrome automation, headless Chrome, or Browser automation. Return the local canvas URL as a clickable link and let the user open it in the Codex side panel. Use browser automation only for developer validation/debugging.

Never start a hidden browser just to make the canvas WebSocket connect. AI Canvas supports offline canvas sync: image holders, inserted images, and new versions can be written through the local service first, then displayed when the user opens the canvas.

## Core Rule

Prefer the two high-level workflow tools:

1. `prepare_image_generation`
2. `prepare_annotation_edit`
3. `watch_edit_requests` for auto edit mode

Use lower-level tools only when the high-level tools return a clear next action or when recovering from an error.

## Tool Availability Gate

For normal user workflows, AI Canvas must run through its MCP tools. If `prepare_image_generation`, `insert_image_into_holder`, `create_image_version`, `save_snapshot`, or `watch_edit_requests` are not callable in the current Codex thread, stop the AI Canvas workflow and say:

```text
AI Canvas 插件已经识别到，但工具没有加载出来。如果你刚安装或刚更新过插件，请完全退出并重新打开 Codex，再发送同一句需求；插件不需要重新安装。
```

Do not inspect the plugin source, search local files, run `curl`, start Node services manually, check ports, read logs, or recreate AI Canvas HTTP calls during a normal image-generation or edit request. Those actions are allowed only when the user explicitly asks to debug or develop the plugin itself.

## Natural Generation Flow

When the user asks to create/generate/make/design a picture, ad, cover, poster, product image, or visual:

1. Call `prepare_image_generation` with the user's original request.
2. Choose aspect ratio automatically if the user did not specify:
   - 小红书封面 or portrait ad: `3:4` or `5:7`; default to `5:7`.
   - 横版封面, banner, hero: `16:9`.
   - square avatar/product/social: `1:1`.
   - unknown: `5:7`.
3. If `readyToGenerate` is false and `needsCanvasOpen` is true:
   - Show the returned canvas URL as a clickable link.
   - Tell the user "画布链接已经准备好，你可以在 Codex 侧边栏打开查看。"
   - Do not start Chrome, headless Chrome, shell `open`, or browser automation to force a canvas connection.
   - If the service provides an output directory and prompt, continue generating the image asset; otherwise stop and ask the user to open the canvas link.
4. Generate the image with Codex image 2.0 using `suggestedPrompt`. If the user asked for text, typography, title design, poster lettering, or brand words, let image 2.0 design those directly in the image.
5. Do not create a separate local text overlay, Python/PIL composition, second layout pass, or alternate final image unless the user explicitly asks for it or the image tool did not produce a usable local image.
6. Pass the generated local image path to `insert_image_into_holder`.
7. Call `save_snapshot`.
8. Tell the user the first image is ready, then clearly hand off to canvas work: "现在请打开画布标注，标完一批后点“按标注修图”。我会在这里等按钮，不是还在生成。"
9. Continue with the `auto-ai-canvas-edit-mode` workflow by polling `watch_edit_requests` until the user says to stop, the Codex app/thread is closed, the task is interrupted, or a blocking clarification is required.

Do not ask the user to select a holder unless there are multiple plausible targets and the system cannot choose safely.

## Natural Edit From Annotation Flow

When the user says any of these:

- "开启自动修图模式"
- "继续自动修图"
- "点按钮后自动修图"
- "自动监听画布修改"
- "要求后续变更"
- "后续修改"
- "继续按图上标注改"
- "根据标注修改"
- "按我画的箭头改"
- "照画布上的意见改图"
- "把这张图按标注做新版"

If the user asks for auto mode, follow the `auto-ai-canvas-edit-mode` skill: watch queued edit requests from the canvas button and process each one.

For a single manual follow-up, do this:

1. Call `prepare_annotation_edit` immediately. Do not ask the user to press the canvas sidebar button first; the canvas autosaves through WebSocket, and this tool reads the latest canvas state.
2. If `readyToEdit` is false:
   - If annotations exist but confidence is low, proceed only when the target image is clear; mention the low-confidence parts briefly.
   - Ask one concise question only when needed, such as "你想修改左边这张还是右边这张？"
   - If the issue is no annotations, ask the user to add an arrow/text/circle on the canvas, or click "保存标注给 Codex" if they want to inspect parsing.
3. Use `inputImagePath`, `screenshotPath`, and `editPrompt` to edit the image with Codex image 2.0.
4. Pass the edited local image path to `create_image_version`.
5. Call `save_snapshot`.
6. Reply that the new version is placed to the right and the original remains unchanged.

Never overwrite an existing image unless the user explicitly says to replace it.

## If The User Only Says "打开 AI 画布"

Call `open_canvas`, show the returned URL as a clickable link, and say the canvas is ready. Do not open an external browser window. Do not explain MCP setup unless it fails.

## If The User Only Says "导出"

For now, explain that the MVP supports asset storage and annotated SVG references, while full production PNG/PDF export is a future feature. If a selected generated image exists, provide its local asset path.

## Prompt Defaults

Generation prompt must preserve the user's intent and include:

- User's original request.
- Canvas aspect ratio.
- Intended use when obvious.
- Subject, style, composition, and required elements.
- Text policy: important copy should preferably be canvas text layers.
- Avoid low quality, broken text, watermark, malformed objects, and messy background.

Edit prompt must include:

- Preserve original composition, lighting, subject, and brand style.
- Modify only annotated regions.
- Keep legible existing text unless asked.
- If a mark is unclear, keep that area unchanged.

## Recovery Behavior

If an insert fails because the canvas browser is not connected:

1. Do not start a browser or hidden browser session.
2. Call `open_canvas` once to ensure the local service is running.
3. Retry the insert. The service should queue the canvas update for later display.
4. If it still fails, return the image file path and canvas URL; ask the user to open the canvas link, then retry after they say it is open.

If multiple target images exist and none is selected:

1. Ask the user which one to edit.
2. Do not guess unless annotations clearly point to one image.

If the user asks about installation or setup:

1. Explain the simple path: install plugin once, restart Codex, then say `@AI Canvas 打开 AI 画布`.
2. Mention technical commands only under a "developer setup" heading.

See `references/annotation-rules.md` and `references/prompt-patterns.md` for details.

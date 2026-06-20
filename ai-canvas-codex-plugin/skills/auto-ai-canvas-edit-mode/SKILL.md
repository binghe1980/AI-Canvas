---
name: auto-ai-canvas-edit-mode
description: "Use when the user wants AI Canvas to automatically process edit jobs submitted from the canvas button, including 开启自动修图模式, 继续自动修图, 自动监听画布修改, 点按钮后自动修图, or continuous AI Canvas annotation edit mode."
---

# Auto AI Canvas Edit Mode

This skill makes the canvas feel one-click after the first setup: the user finishes a batch of annotations on an image, clicks `按标注修图` on the canvas, and Codex processes that queued edit request. Do not treat every single arrow/text mark as an automatic trigger; the user's manual button click is the commit point.

## Tool Availability Gate

This workflow must use `watch_edit_requests`, `create_image_version`, `save_snapshot`, and `update_edit_request`. If these tools are not callable in the current Codex thread, stop and tell the user:

```text
AI Canvas 插件已经识别到，但自动修图工具没有加载出来。如果你刚安装或刚更新过插件，请完全退出并重新打开 Codex，再发送同一句需求；插件不需要重新安装。
```

Do not recreate the listener with shell scripts, `curl`, port checks, or manual service startup during normal use. Those actions are only for explicit plugin development/debugging.

## Workflow

1. Tell the user briefly: `图片已经在画布里了。现在轮到你去画布上标注：画箭头、写修改意见，标完一批后点“按标注修图”，我会自动接着处理。`
2. Call `watch_edit_requests` with `waitMs` around 30000-45000 and `claim: true`.
3. If the result times out with no request:
   - Continue polling. Do not stop because of an idle timer.
   - The mode ends only when the user says to stop, the Codex app/thread is closed, the current task is interrupted, or a blocking clarification is required.
   - Each individual `watch_edit_requests` call may use a bounded `waitMs`; the overall listening loop is unbounded.
   - If you say anything while waiting, make it clear that generation is complete and Codex is waiting for the user to work in the canvas, not still generating.
4. When a request arrives:
   - If `canAutoEdit` is false, call `update_edit_request` with `needs_clarification` and ask one concise clarification.
   - If `canAutoEdit` is true, use `inputImagePath`, `editPrompt`, `annotationPlan`, and `screenshotPath` to edit the image with the available Codex image-editing capability.
   - Save the edited file under the request `storagePath` assets area when a local output path is needed.
   - Call `create_image_version` using `sourceShapeId = targetShapeId`, placement `right`, and a title like `AI 图片 v2`.
   - Call `save_snapshot`.
   - Call `update_edit_request` with `completed` and include the new shape id, run id, and output image path when available.
5. Continue watching for another request when the user asked for continuous mode. Stop only when the user says to stop, the goal is paused, or there is a blocking clarification.

## Stop Behavior

When the user says `停止监听`, `停止自动修图`, `先停一下`, `不用继续等了`, or similar:

1. Stop polling `watch_edit_requests`.
2. Reply with a clear guide instead of only saying "stopped":

```text
已停止监听。

你可以继续在画布里查看或标注；但现在点“按标注修图”只会保存任务，不会自动开始修图。

以后要继续时，回到 Codex 说：AI Canvas 继续自动修图。
```

Do not call canvas tools after the user asks to stop unless they also ask to save, inspect, or resume.

## Failure Handling

- If image editing fails, call `update_edit_request` with `failed` and the error.
- If canvas insertion fails, keep the generated image file and report that the file exists but insertion failed.
- Never overwrite old images. New edits create versions to the right.

## User-Facing Tone

Be short while watching:

- "图片已经好了。现在请去画布上标注，标完一批后点“按标注修图”。"
- "我会在这里等画布按钮，不是还在生成图。你可以先去画布操作。"
- "收到一个修图任务，我开始处理。"
- "新版已经放到右侧，旧图保留。"
- "已停止监听。你可以继续查看或标注画布；以后要继续时，在 Codex 说“AI Canvas 继续自动修图”。"

Avoid exposing raw JSON unless the user asks to debug.

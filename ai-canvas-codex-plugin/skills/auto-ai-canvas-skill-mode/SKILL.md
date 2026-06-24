---
name: auto-ai-canvas-skill-mode
description: "Use when the user wants AI Canvas to process Skill jobs submitted from the canvas Skill panel, including 继续处理 Skill, 处理画布 Skill, 小红书封面 Skill, or canvas skill requests."
---

# Auto AI Canvas Skill Mode

This skill processes executable AI Canvas Skill requests submitted from the canvas Skill panel. Current executable scope covers `xiaohongshu-cover`, `youtube-thumbnail`, `cross-platform-adapt`, `product-marketing-set`, `logo-and-brand`, and `marketing-brochure`.

## Tool Availability Gate

This workflow must use `watch_skill_requests`, `submit_canvas_skill_request`, `create_image_version`, `import_image_asset`, `save_snapshot`, and `update_skill_request`. It only uses `apply_canvas_actions` when an older request explicitly includes `overlayActions`. If these tools are not callable in the current Codex thread, stop and tell the user:

```text
AI Canvas 插件已经识别到，但 Skill 处理工具没有加载出来。如果你刚安装或刚更新过插件，请完全退出并重新打开 Codex，再发送同一句需求；插件不需要重新安装。
```

Do not recreate the listener with shell scripts, `curl`, port checks, or manual service startup during normal use. Those actions are only for explicit plugin development/debugging.

## Workflow

1. Tell the user briefly: `我会等画布里的 Skill 请求。你在画布里选中图片，选择 Skill，再点“提交给 Codex 生成”。`
2. Call `watch_skill_requests` with `waitMs` around 30000-45000 and `claim: true`.
3. If the result times out with no request:
   - Continue polling while the user expects automatic Skill handling.
   - Do not stop because of one idle timer.
   - If you say anything while waiting, make clear that Codex is waiting for a canvas Skill submission, not generating yet.
4. When a request arrives:
   - If `canAutoGenerate` is false or (`inputImagePath` is missing and `skillId` is neither `logo-and-brand` nor `marketing-brochure`), call `update_skill_request` with `needs_clarification` and tell the user to re-import the image via upload, drag, or paste.
   - If `skillId` is not one of `xiaohongshu-cover`, `youtube-thumbnail`, `cross-platform-adapt`, `product-marketing-set`, `logo-and-brand`, or `marketing-brochure`, call `update_skill_request` with `needs_clarification`; that Skill is not part of the executable loop yet.
   - If `skillId` is `cross-platform-adapt`, `product-marketing-set`, `logo-and-brand`, or `marketing-brochure` and `briefStatus` is `needs_input`, do **not** generate images. Call `update_skill_request` with `needs_clarification`, then ask the user the `clarificationQuestions` in normal conversation, at most 3 questions at a time. After the user answers, merge their answers into the original `brief`, briefly summarize the output plan, ask for confirmation when the plan is ambiguous, then call `submit_canvas_skill_request` again with the same `skillId` and the completed `brief`.
   - Build `jobs = generationJobs` when present and non-empty; otherwise use `[generationJob]`.
   - Process jobs sequentially. For each job:
     - Use `job.prompt` as the generation/editing prompt. If `inputImagePath` exists, use it as the reference image; if it is missing for `logo-and-brand` or `marketing-brochure`, generate from the text brief alone.
     - Generate exactly one result image for that job using the available Codex image-generation/image-editing capability.
     - Follow the job prompt carefully. For 小红书, YouTube, cross-platform adaptation, product marketing, Logo/brand, and marketing brochure jobs, generate the final designed image directly: platform-safe recomposition/cropping, title typography when requested, colors, layout, decoration, brand/campaign system details, and visual hierarchy must be baked into the raster image.
     - Do not create separate canvas text boxes for title design unless the request explicitly includes `overlayActions`.
     - Save the generated image at `job.outputDir/job.outputName` when a local output path is needed.
     - If `targetShapeId` exists, call `create_image_version` with:
       - `sourceShapeId = targetShapeId`
       - `imagePath = generated local image path`
       - `placement = "right"`
       - `title = job.title`
       - `runId = runId`
       - `x = job.placement.x`
       - `y = job.placement.y`
       - `w = job.placement.w`
       - `h = job.placement.h`
     - If `targetShapeId` is missing, call `import_image_asset` with:
       - `inputPath = generated local image path`
       - `source = "codex_generation"`
       - `title = job.title`
       - `placement = "absolute"`
       - `x = job.placement.x`
       - `y = job.placement.y`
       - `w = job.placement.w`
       - `h = job.placement.h`
       - `selectAfterCreate = true`
     - Remember the output path and returned `newShapeId` or `shapeId`.
     - For multi-job Skills, call `update_skill_request` with status `processing` after each completed job and include partial progress in `result`, so the user can see that the sequence is moving.
   - If the request includes `overlayActions`, call `apply_canvas_actions` with those actions for backward compatibility. New 小红书 and YouTube Skill requests normally should not include overlay actions.
   - Call `save_snapshot`.
   - Call `update_skill_request` with `completed` and include every new shape id, run id, output image path, job id, and overlay result in `result`.
5. Continue watching only if the user asked for continuous Skill handling. Stop when the user says to stop, the thread is interrupted, or a blocking clarification is required.

## Stop Behavior

When the user says `停止监听`, `停止处理 Skill`, `先停一下`, `不用继续等了`, or similar:

1. Stop polling `watch_skill_requests`.
2. Reply clearly:

```text
已停止处理 Skill。

你可以继续在画布里查看；但现在提交 Skill 只会保存任务，不会自动开始生成。

以后要继续时，回到 Codex 说：AI Canvas 继续处理 Skill。
```

## User-Facing Tone

Be direct and product-like:

- "我会等画布里的 Skill 请求。"
- "收到 Skill 任务，我开始生成。"
- "这个产品套图还缺少几个关键信息，我先问清楚再生成。"
- "这个品牌简报还缺少几个关键信息，我先问清楚再生成。"
- "这个营销宣传册还缺少几个关键信息，我先问清楚再生成。"
- "这个跨平台适配还缺少几个关键信息，我先问清楚再生成。"
- "结果已经放到原图右侧，旧图保留。"
- "这张图没有本地文件路径，请用导入、拖拽或粘贴重新放入画布后再提交。"

Avoid exposing raw JSON unless the user asks to debug.

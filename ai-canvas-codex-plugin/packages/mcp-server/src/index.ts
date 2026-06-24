import {
  applyCanvasActionsInputSchema,
  collectAnnotationsInputSchema,
  createImageHolderInputSchema,
  createImageVersionInputSchema,
  getSkillRunInputSchema,
  getEditRequestInputSchema,
  getSkillRequestInputSchema,
  importImageAssetInputSchema,
  importImageFromUrlInputSchema,
  insertImageIntoHolderInputSchema,
  listCanvasSkillsInputSchema,
  openCanvasInputSchema,
  prepareAnnotationEditInputSchema,
  prepareImageGenerationInputSchema,
  prepareSkillRunInputSchema,
  recommendCanvasSkillsInputSchema,
  runCanvasSkillInputSchema,
  saveSnapshotInputSchema,
  submitSkillRequestInputSchema,
  updateEditRequestInputSchema,
  updateSkillRequestInputSchema,
  watchEditRequestsInputSchema,
  watchSkillRequestsInputSchema
} from '@ai-canvas/shared'
import type {
  AnnotationInstruction,
  CanvasEditRequest,
  CanvasSkillRequest,
  CanvasStatePayload,
  EditRequestPollResult,
  PreparedAnnotationEdit,
  PreparedImageGeneration,
  ShapeSummary,
  SkillRequestPollResult
} from '@ai-canvas/shared'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import path from 'node:path'
import { z } from 'zod'
import { parseAnnotations } from './annotations/parseAnnotations.js'
import { fetchJson, getCanvasState, getSelection, openCanvas, postJson } from './canvas/client.js'
import { assertReadableFile } from './utils/paths.js'

function asToolResult(value: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(value, null, 2)
      }
    ],
    structuredContent: value as Record<string, unknown>
  }
}

const server = new McpServer({
  name: 'ai-canvas-mcp',
  version: '0.1.0'
})

function holderSize(aspectRatio: string, input?: { w?: number; h?: number }) {
  if (input?.w && input?.h) return { w: input.w, h: input.h }
  const [rawW, rawH] = aspectRatio.split(':').map((part) => Number(part))
  if (Number.isFinite(rawW) && Number.isFinite(rawH) && rawW > 0 && rawH > 0) {
    const base = 420
    return { w: base, h: Math.round((base * rawH) / rawW) }
  }
  return { w: 420, h: 588 }
}

function findPreferredHolder(state: CanvasStatePayload) {
  const selectedHolder = state.selection.shapes.find((shape) => shape.role === 'image_holder')
  if (selectedHolder) return selectedHolder
  const holders = state.shapes.filter((shape) => shape.role === 'image_holder')
  if (holders.length === 1) return holders[0]
  return undefined
}

function generationPrompt(input: {
  request: string
  aspectRatio: string
  intendedUse?: string
}) {
  return [
    `请生成一张图片。`,
    ``,
    `用户需求：${input.request}`,
    `画面比例：${input.aspectRatio}`,
    input.intendedUse ? `用途：${input.intendedUse}` : undefined,
    `构图要求：主体明确，适合放入画布继续标注修改。`,
    `文字策略：如果用户要求标题、广告语或字体风格，请把文字作为画面创意的一部分直接设计进图片，充分发挥字体设计和排版能力。`,
    `避免：低清晰度、错乱文字、水印、畸形主体、杂乱背景。`
  ]
    .filter(Boolean)
    .join('\n')
}

function formatAnnotation(annotation: AnnotationInstruction, index: number) {
  const region = annotation.region
  return `${index + 1}. 在图片相对区域 x=${region.x.toFixed(2)}, y=${region.y.toFixed(
    2
  )}, w=${region.w.toFixed(2)}, h=${region.h.toFixed(2)}：${annotation.instruction}`
}

function editPrompt(input: {
  userRequest?: string
  annotations: AnnotationInstruction[]
}) {
  const annotationList = input.annotations.length
    ? input.annotations.map(formatAnnotation).join('\n')
    : '没有可靠的结构化标注。请优先保持原图不变，等待用户补充说明。'
  return [
    `基于输入图片进行编辑。保持整体构图、主体位置、光影风格、画面质感和品牌视觉风格不变。`,
    input.userRequest ? `用户补充要求：${input.userRequest}` : undefined,
    ``,
    `请根据以下画布标注进行修改：`,
    annotationList,
    ``,
    `不要改变：`,
    `- 未标注区域。`,
    `- 品牌名和主要标题，除非用户明确要求。`,
    `- 原图整体比例、风格和主体识别度。`,
    ``,
    `输出要求：与原图相同比例；修改自然；如果某条标注意图不明确，优先保持原样。`
  ]
    .filter((line) => line !== undefined)
    .join('\n')
}

function imagePathFromState(state: CanvasStatePayload, shape?: ShapeSummary) {
  if (!shape?.assetPath) return undefined
  return path.join(state.storagePath, shape.assetPath)
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

server.registerTool(
  'open_canvas',
  {
    title: 'Open AI Canvas',
    description: 'Start or open the local AI Canvas service.',
    inputSchema: openCanvasInputSchema
  },
  async (input) => {
    const parsed = openCanvasInputSchema.parse(input)
    return asToolResult(await openCanvas(parsed))
  }
)

server.registerTool(
  'prepare_image_generation',
  {
    title: 'Prepare Image Generation',
    description:
      'Conversation-first workflow entry: open AI Canvas, find or create a holder, and return the prompt/output target for image generation.',
    inputSchema: prepareImageGenerationInputSchema
  },
  async (input) => {
    const parsed = prepareImageGenerationInputSchema.parse(input)
    const opened = await openCanvas(parsed)
    let state = await getCanvasState()
    let holder = findPreferredHolder(state)

    if (!holder) {
      const size = holderSize(parsed.aspectRatio, parsed)
      try {
        const created = await postJson<{ shapeId: string; bounds: { x: number; y: number; w: number; h: number } }>(
          '/api/canvas/shape',
          {
            label: parsed.label,
            aspectRatio: parsed.aspectRatio,
            x: parsed.x,
            y: parsed.y,
            ...size
          }
        )
        await postJson('/api/canvas/save', {})
        state = await getCanvasState()
        holder =
          state.shapes.find((shape) => shape.id === created.shapeId) ??
          ({
            id: created.shapeId,
            type: 'geo',
            role: 'image_holder',
            bounds: created.bounds,
            aspectRatio: parsed.aspectRatio
          } satisfies ShapeSummary)
      } catch (error) {
        const result: PreparedImageGeneration = {
          readyToGenerate: false,
          needsCanvasOpen: true,
          message:
            'AI Canvas 已启动，但图片框还没有创建成功。请保留生成结果文件，并把返回的画布 URL 提供给用户打开查看。',
          url: opened.url,
          canvasId: opened.canvasId,
          storagePath: opened.storagePath,
          aspectRatio: parsed.aspectRatio,
          outputDir: path.join(opened.storagePath, 'assets/images'),
          suggestedPrompt: generationPrompt(parsed)
        }
        return asToolResult({
          ...result,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    const result: PreparedImageGeneration = {
      readyToGenerate: true,
      needsCanvasOpen: false,
      message: 'AI Canvas 已准备好。请生成图片，并用 insert_image_into_holder 插入 holder。',
      url: opened.url,
      canvasId: opened.canvasId,
      storagePath: opened.storagePath,
      holderShapeId: holder.id,
      holderBounds: holder.bounds,
      aspectRatio: holder.aspectRatio ?? parsed.aspectRatio,
      outputDir: path.join(opened.storagePath, 'assets/images'),
      suggestedPrompt: generationPrompt({
        request: parsed.request,
        aspectRatio: holder.aspectRatio ?? parsed.aspectRatio,
        intendedUse: parsed.intendedUse
      })
    }
    return asToolResult(result)
  }
)

server.registerTool(
  'get_selection',
  {
    title: 'Get Canvas Selection',
    description: 'Read the current canvas selection and shape summaries.',
    inputSchema: z.object({})
  },
  async () => asToolResult(await getSelection())
)

server.registerTool(
  'create_image_holder',
  {
    title: 'Create Image Holder',
    description: 'Create an AI image placeholder on the current canvas.',
    inputSchema: createImageHolderInputSchema
  },
  async (input) => {
    const parsed = createImageHolderInputSchema.parse(input)
    return asToolResult(await postJson('/api/canvas/shape', parsed))
  }
)

server.registerTool(
  'insert_image_into_holder',
  {
    title: 'Insert Image Into Holder',
    description: 'Copy a local image into canvas assets and place it over a holder.',
    inputSchema: insertImageIntoHolderInputSchema
  },
  async (input) => {
    const parsed = insertImageIntoHolderInputSchema.parse(input)
    const imagePath = await assertReadableFile(parsed.imagePath)
    return asToolResult(await postJson('/api/canvas/asset', { ...parsed, imagePath }))
  }
)

server.registerTool(
  'import_image_asset',
  {
    title: 'Import Image Asset',
    description:
      'Import a local image file into AI Canvas as a selectable image that can be used by canvas Skills.',
    inputSchema: importImageAssetInputSchema
  },
  async (input) => {
    const parsed = importImageAssetInputSchema.parse(input)
    if (parsed.workspaceRoot || parsed.canvasId || parsed.port) {
      await openCanvas(parsed)
    }
    const inputPath = await assertReadableFile(parsed.inputPath)
    return asToolResult(await postJson('/api/canvas/import-file', { ...parsed, inputPath }))
  }
)

server.registerTool(
  'import_image_from_url',
  {
    title: 'Import Image From URL',
    description:
      'Download a supported image URL and import it into AI Canvas as a selectable image.',
    inputSchema: importImageFromUrlInputSchema
  },
  async (input) => {
    const parsed = importImageFromUrlInputSchema.parse(input)
    if (parsed.workspaceRoot || parsed.canvasId || parsed.port) {
      await openCanvas(parsed)
    }
    return asToolResult(await postJson('/api/canvas/import-url', parsed))
  }
)

server.registerTool(
  'collect_annotations',
  {
    title: 'Collect Canvas Annotations',
    description: 'Collect nearby arrow/text/shape annotations for an AI image.',
    inputSchema: collectAnnotationsInputSchema
  },
  async (input) => {
    const parsed = collectAnnotationsInputSchema.parse(input)
    const state = await getCanvasState()
    const plan = parseAnnotations({
      state,
      targetShapeId: parsed.targetShapeId,
      radius: parsed.radius
    })
    if (parsed.includeScreenshot && plan.targetShapeId) {
      const shapeIds = [
        plan.targetShapeId,
        ...plan.annotationPlan.flatMap((annotation) => annotation.sourceShapeIds)
      ]
      const exported = await postJson<{ screenshotPath: string; absolutePath: string }>(
        '/api/canvas/export',
        { shapeIds }
      )
      plan.screenshotPath = exported.screenshotPath
    }
    return asToolResult(plan)
  }
)

server.registerTool(
  'prepare_annotation_edit',
  {
    title: 'Prepare Annotation Edit',
    description:
      'Conversation-first workflow entry: collect annotations, export a marked reference, and return a ready image-edit prompt.',
    inputSchema: prepareAnnotationEditInputSchema
  },
  async (input) => {
    const parsed = prepareAnnotationEditInputSchema.parse(input)
    if (parsed.workspaceRoot || parsed.canvasId || parsed.port) {
      await openCanvas(parsed)
    }
    const state = await getCanvasState()
    const plan = parseAnnotations({
      state,
      targetShapeId: parsed.targetShapeId,
      radius: parsed.radius
    })
    const target = state.shapes.find((shape) => shape.id === plan.targetShapeId)
    if (parsed.includeScreenshot && plan.targetShapeId) {
      const shapeIds = [
        plan.targetShapeId,
        ...plan.annotationPlan.flatMap((annotation) => annotation.sourceShapeIds)
      ]
      const exported = await postJson<{ screenshotPath: string; absolutePath: string }>(
        '/api/canvas/export',
        { shapeIds }
      )
      plan.screenshotPath = exported.screenshotPath
    }

    const result: PreparedAnnotationEdit = {
      ...plan,
      readyToEdit: !plan.needsClarification && Boolean(plan.targetImagePath),
      storagePath: state.storagePath,
      url: undefined,
      inputImagePath: imagePathFromState(state, target),
      editPrompt: editPrompt({
        userRequest: parsed.userRequest,
        annotations: plan.annotationPlan
      })
    }
    return asToolResult(result)
  }
)

server.registerTool(
  'watch_edit_requests',
  {
    title: 'Watch AI Canvas Edit Requests',
    description:
      'Wait for an edit request submitted from the AI Canvas button. Use for auto edit mode.',
    inputSchema: watchEditRequestsInputSchema
  },
  async (input) => {
    const parsed = watchEditRequestsInputSchema.parse(input)
    if (parsed.workspaceRoot || parsed.canvasId || parsed.port) {
      await openCanvas(parsed)
    }
    const deadline = Date.now() + parsed.waitMs
    let pollResult: EditRequestPollResult | undefined

    do {
      pollResult = await postJson<EditRequestPollResult>('/api/canvas/edit-requests/next', {
        claim: parsed.claim,
        includeCompleted: parsed.includeCompleted
      })
      if (pollResult.request) return asToolResult(pollResult)
      if (Date.now() >= deadline) break
      await sleep(Math.min(1000, Math.max(250, deadline - Date.now())))
    } while (Date.now() < deadline)

    return asToolResult({
      request: undefined,
      timedOut: true,
      message:
        'No queued AI Canvas edit request yet. The image is ready; Codex is waiting for the user to annotate the canvas and click 按标注修图.'
    } satisfies EditRequestPollResult)
  }
)

server.registerTool(
  'get_edit_request',
  {
    title: 'Get AI Canvas Edit Request',
    description: 'Read one queued, processing, completed, failed, or clarification edit request by id.',
    inputSchema: getEditRequestInputSchema
  },
  async (input) => {
    const parsed = getEditRequestInputSchema.parse(input)
    return asToolResult(await fetchJson<CanvasEditRequest>(`/api/canvas/edit-requests/${encodeURIComponent(parsed.requestId)}`))
  }
)

server.registerTool(
  'update_edit_request',
  {
    title: 'Update AI Canvas Edit Request',
    description: 'Mark an AI Canvas edit request as completed, failed, processing, queued, or needing clarification.',
    inputSchema: updateEditRequestInputSchema
  },
  async (input) => {
    const parsed = updateEditRequestInputSchema.parse(input)
    return asToolResult(
      await postJson<CanvasEditRequest>(
        `/api/canvas/edit-requests/${encodeURIComponent(parsed.requestId)}/status`,
        parsed
      )
    )
  }
)

server.registerTool(
  'submit_canvas_skill_request',
  {
    title: 'Submit Canvas Skill Request',
    description:
      'Submit a canvas Skill request. Supports xiaohongshu-cover, youtube-thumbnail, cross-platform-adapt, product-marketing-set, logo-and-brand, and marketing-brochure.',
    inputSchema: submitSkillRequestInputSchema
  },
  async (input) => {
    const parsed = submitSkillRequestInputSchema.parse(input)
    if (parsed.workspaceRoot || parsed.canvasId || parsed.port) {
      await openCanvas(parsed)
    }
    return asToolResult(await postJson('/api/canvas/skill-request', parsed))
  }
)

server.registerTool(
  'watch_skill_requests',
  {
    title: 'Watch AI Canvas Skill Requests',
    description:
      'Wait for a queued AI Canvas Skill request submitted from the canvas Skill panel and process its generationJobs sequentially.',
    inputSchema: watchSkillRequestsInputSchema
  },
  async (input) => {
    const parsed = watchSkillRequestsInputSchema.parse(input)
    if (parsed.workspaceRoot || parsed.canvasId || parsed.port) {
      await openCanvas(parsed)
    }
    const deadline = Date.now() + parsed.waitMs
    let pollResult: SkillRequestPollResult | undefined

    do {
      pollResult = await postJson<SkillRequestPollResult>('/api/canvas/skill-requests/next', {
        claim: parsed.claim,
        includeCompleted: parsed.includeCompleted
      })
      if (pollResult.request) return asToolResult(pollResult)
      if (Date.now() >= deadline) break
      await sleep(Math.min(1000, Math.max(250, deadline - Date.now())))
    } while (Date.now() < deadline)

    return asToolResult({
      request: undefined,
      timedOut: true,
      message:
        'No queued AI Canvas Skill request yet. Codex is waiting for the user to select an image, choose a Skill, and submit it from the canvas Skill panel.'
    } satisfies SkillRequestPollResult)
  }
)

server.registerTool(
  'get_skill_request',
  {
    title: 'Get AI Canvas Skill Request',
    description: 'Read one queued, processing, completed, failed, or clarification AI Canvas Skill request by id.',
    inputSchema: getSkillRequestInputSchema
  },
  async (input) => {
    const parsed = getSkillRequestInputSchema.parse(input)
    return asToolResult(
      await fetchJson<CanvasSkillRequest>(`/api/canvas/skill-requests/${encodeURIComponent(parsed.requestId)}`)
    )
  }
)

server.registerTool(
  'update_skill_request',
  {
    title: 'Update AI Canvas Skill Request',
    description: 'Mark an AI Canvas Skill request as completed, failed, processing, queued, or needing clarification.',
    inputSchema: updateSkillRequestInputSchema
  },
  async (input) => {
    const parsed = updateSkillRequestInputSchema.parse(input)
    return asToolResult(
      await postJson<CanvasSkillRequest>(
        `/api/canvas/skill-requests/${encodeURIComponent(parsed.requestId)}/status`,
        parsed
      )
    )
  }
)

server.registerTool(
  'list_canvas_skills',
  {
    title: 'List Canvas Skills',
    description: 'List built-in AI Canvas Skills grouped by category.',
    inputSchema: listCanvasSkillsInputSchema
  },
  async (input) => {
    const parsed = listCanvasSkillsInputSchema.parse(input)
    const suffix = parsed.category ? `?category=${encodeURIComponent(parsed.category)}` : ''
    return asToolResult(await fetchJson(`/api/canvas/skills${suffix}`))
  }
)

server.registerTool(
  'recommend_canvas_skills',
  {
    title: 'Recommend Canvas Skills',
    description: 'Recommend AI Canvas Skills based on the current selection and optional user request.',
    inputSchema: recommendCanvasSkillsInputSchema
  },
  async (input) => {
    const parsed = recommendCanvasSkillsInputSchema.parse(input)
    if (parsed.workspaceRoot || parsed.canvasId || parsed.port) {
      await openCanvas(parsed)
    }
    return asToolResult(await postJson('/api/canvas/skills/recommend', parsed))
  }
)

server.registerTool(
  'prepare_skill_run',
  {
    title: 'Prepare Canvas Skill Run',
    description: 'Create a lightweight run plan for an AI Canvas Skill using current canvas context.',
    inputSchema: prepareSkillRunInputSchema
  },
  async (input) => {
    const parsed = prepareSkillRunInputSchema.parse(input)
    if (parsed.workspaceRoot || parsed.canvasId || parsed.port) {
      await openCanvas(parsed)
    }
    return asToolResult(await postJson('/api/canvas/skills/prepare-run', parsed))
  }
)

server.registerTool(
  'run_canvas_skill',
  {
    title: 'Run Canvas Skill',
    description:
      'Run a prepared AI Canvas Skill and return external generation jobs plus placement plans for Codex to process.',
    inputSchema: runCanvasSkillInputSchema
  },
  async (input) => {
    const parsed = runCanvasSkillInputSchema.parse(input)
    if (parsed.workspaceRoot || parsed.canvasId || parsed.port) {
      await openCanvas(parsed)
    }
    return asToolResult(await postJson('/api/canvas/skills/run', parsed))
  }
)

server.registerTool(
  'get_skill_run',
  {
    title: 'Get Canvas Skill Run',
    description: 'Read a previously prepared or run AI Canvas Skill run by id.',
    inputSchema: getSkillRunInputSchema
  },
  async (input) => {
    const parsed = getSkillRunInputSchema.parse(input)
    return asToolResult(await fetchJson(`/api/canvas/skill-runs/${encodeURIComponent(parsed.runId)}`))
  }
)

server.registerTool(
  'apply_canvas_actions',
  {
    title: 'Apply Canvas Actions',
    description: 'Apply a batch of normalized Canvas Actions to the current AI Canvas.',
    inputSchema: applyCanvasActionsInputSchema
  },
  async (input) => {
    const parsed = applyCanvasActionsInputSchema.parse(input)
    if (parsed.workspaceRoot || parsed.canvasId || parsed.port) {
      await openCanvas(parsed)
    }
    return asToolResult(await postJson('/api/canvas/actions', parsed))
  }
)

server.registerTool(
  'create_image_version',
  {
    title: 'Create Image Version',
    description: 'Copy a local edited image into canvas assets and place it as a new version.',
    inputSchema: createImageVersionInputSchema
  },
  async (input) => {
    const parsed = createImageVersionInputSchema.parse(input)
    const imagePath = await assertReadableFile(parsed.imagePath)
    return asToolResult(await postJson('/api/canvas/version', { ...parsed, imagePath }))
  }
)

server.registerTool(
  'save_snapshot',
  {
    title: 'Save Canvas Snapshot',
    description: 'Force persistence of the current tldraw snapshot.',
    inputSchema: saveSnapshotInputSchema
  },
  async () => asToolResult(await postJson('/api/canvas/save', {}))
)

const transport = new StdioServerTransport()
await server.connect(transport)

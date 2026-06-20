import type {
  CanvasMetadata,
  CanvasEditRequest,
  CanvasPendingOperation,
  CanvasStatePayload,
  EditRequestStatus,
  EditRequestQueueStatus,
  PreparedAnnotationEdit,
  RunRecord,
  SelectionSnapshot,
  ShapeSummary
} from '@ai-canvas/shared'
import { buildAnnotationEditPrompt, parseAnnotations } from '@ai-canvas/shared'
import express from 'express'
import { existsSync, readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { access, copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { nanoid } from 'nanoid'
import { WebSocket, WebSocketServer } from 'ws'

type PendingCommand = {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: NodeJS.Timeout
}

type CanvasSession = {
  workspaceRoot: string
  canvasId: string
  storagePath: string
  metadata: CanvasMetadata
  snapshot?: unknown
  selection: SelectionSnapshot
  shapes: ShapeSummary[]
  pendingOperations: CanvasPendingOperation[]
}

const APP_VERSION = '0.1.0'
const FEATURES = ['annotationEditRequests', 'editRequestQueue', 'offlineCanvasSync']
const LISTENER_ACTIVE_WINDOW_MS = 75_000
const DEFAULT_PORT = Number(process.env.AI_CANVAS_PORT ?? 43218)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pluginRoot = findPluginRoot(__dirname)
const clientDist = path.resolve(pluginRoot, 'packages/canvas-app/dist/client')
const clientIndex = path.join(clientDist, 'index.html')
const pendingCommands = new Map<string, PendingCommand>()
const clients = new Set<WebSocket>()

let session: CanvasSession | undefined
let codexListenerLastSeenAt: string | undefined

function nowIso() {
  return new Date().toISOString()
}

function parseArgs(argv: string[]) {
  const args = new Map<string, string>()
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index]
    if (!item.startsWith('--')) continue
    const key = item.slice(2)
    const value = argv[index + 1]?.startsWith('--') ? 'true' : argv[index + 1] ?? 'true'
    args.set(key, value)
  }
  return args
}

function findPluginRoot(startPath: string) {
  let current = startPath
  for (let index = 0; index < 8; index += 1) {
    const packageJsonPath = path.join(current, 'package.json')
    if (existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(String(readFileSync(packageJsonPath)))
        if (packageJson.name === 'ai-canvas-codex-plugin') return current
      } catch {
        // Keep walking.
      }
    }
    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }
  return path.resolve(startPath, '../../..')
}

function slugId(prefix: string) {
  return `${prefix}_${nanoid(10)}`
}

async function exists(targetPath: string) {
  try {
    await access(targetPath)
    return true
  } catch {
    return false
  }
}

async function readJson<T>(targetPath: string): Promise<T | undefined> {
  if (!(await exists(targetPath))) return undefined
  const raw = await readFile(targetPath, 'utf8')
  return JSON.parse(raw) as T
}

async function writeJson(targetPath: string, value: unknown) {
  await mkdir(path.dirname(targetPath), { recursive: true })
  await writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function ensureInside(root: string, candidate: string) {
  const relative = path.relative(root, candidate)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Path escapes canvas storage: ${candidate}`)
  }
}

function getCanvasHome(workspaceRoot: string) {
  return process.env.AI_CANVAS_HOME
    ? path.resolve(process.env.AI_CANVAS_HOME)
    : path.join(workspaceRoot, '.ai-canvas')
}

async function ensureCanvasDirs(storagePath: string) {
  await mkdir(path.join(storagePath, 'assets/images'), { recursive: true })
  await mkdir(path.join(storagePath, 'assets/thumbnails'), { recursive: true })
  await mkdir(path.join(storagePath, 'runs'), { recursive: true })
  await mkdir(path.join(storagePath, 'exports'), { recursive: true })
  await mkdir(path.join(storagePath, 'requests'), { recursive: true })
  await mkdir(path.join(storagePath, 'operations'), { recursive: true })
  await mkdir(path.join(storagePath, 'logs'), { recursive: true })
}

async function openSession(input: { workspaceRoot?: string; canvasId?: string }) {
  const workspaceRoot = path.resolve(
    input.workspaceRoot ?? process.env.AI_CANVAS_WORKSPACE_ROOT ?? process.cwd()
  )
  const canvasId = input.canvasId ?? process.env.AI_CANVAS_CANVAS_ID ?? slugId('canvas')
  const canvasHome = getCanvasHome(workspaceRoot)
  const storagePath = path.join(canvasHome, 'canvases', canvasId)
  ensureInside(canvasHome, storagePath)
  await ensureCanvasDirs(storagePath)

  const metadataPath = path.join(storagePath, 'metadata.json')
  const existingMetadata = await readJson<CanvasMetadata>(metadataPath)
  const existingSummary = await readJson<{
    selection?: SelectionSnapshot
    shapes?: ShapeSummary[]
  }>(path.join(storagePath, 'state-summary.json'))
  const pendingOperations =
    (await readJson<CanvasPendingOperation[]>(
      path.join(storagePath, 'operations', 'pending.json')
    )) ?? []
  const metadata: CanvasMetadata = existingMetadata ?? {
    canvasId,
    name: 'Untitled AI Canvas',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    workspaceRoot,
    activePageId: 'page:page',
    appVersion: APP_VERSION
  }

  const snapshot = await readJson<unknown>(path.join(storagePath, 'canvas.json'))
  const selection: SelectionSnapshot = existingSummary?.selection ?? {
    canvasId,
    pageId: metadata.activePageId,
    selectedShapeIds: [],
    shapes: []
  }

  session = {
    workspaceRoot,
    canvasId,
    storagePath,
    metadata,
    snapshot,
    selection,
    shapes: existingSummary?.shapes ?? [],
    pendingOperations
  }

  await writeJson(path.join(canvasHome, 'config.json'), {
    version: APP_VERSION,
    defaultPort: DEFAULT_PORT,
    storageMode: 'local',
    imageModel: 'codex-image-2.0',
    defaultCanvasName: 'Untitled AI Canvas',
    assetPolicy: {
      copyExternalImages: true,
      generateThumbnails: false,
      keepAllVersions: true
    }
  })
  await persistSession()
  return session
}

async function persistSession() {
  if (!session) return
  session.metadata.updatedAt = nowIso()
  await writeJson(path.join(session.storagePath, 'metadata.json'), session.metadata)
  if (session.snapshot) {
    await writeJson(path.join(session.storagePath, 'canvas.json'), session.snapshot)
  }
  await writeJson(path.join(session.storagePath, 'state-summary.json'), {
    selection: session.selection,
    shapes: session.shapes,
    updatedAt: session.metadata.updatedAt
  })
  await writeJson(
    path.join(session.storagePath, 'operations', 'pending.json'),
    session.pendingOperations
  )
}

function statePayload(): CanvasStatePayload {
  if (!session) {
    throw new Error('Canvas session is not open')
  }
  return {
    canvasId: session.canvasId,
    metadata: session.metadata,
    storagePath: session.storagePath,
    snapshot: session.snapshot,
    selection: session.selection,
    shapes: session.shapes,
    pendingOperations: session.pendingOperations
  }
}

function sendCommand(command: string, payload: Record<string, unknown>) {
  const openClients = [...clients].filter((client) => client.readyState === WebSocket.OPEN)
  if (openClients.length === 0) {
    throw new Error('Canvas browser is not connected yet')
  }

  const id = nanoid()
  const message = JSON.stringify({ type: 'command', id, command, payload })
  const promise = new Promise<unknown>((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingCommands.delete(id)
      reject(new Error(`Canvas command timed out: ${command}`))
    }, 12_000)
    pendingCommands.set(id, { resolve, reject, timer })
  })
  openClients[0].send(message)
  return promise
}

function hasCanvasClient() {
  return [...clients].some((client) => client.readyState === WebSocket.OPEN)
}

function makeShapeId(prefix: string) {
  return `shape:${prefix}_${nanoid(8)}`
}

function upsertShapeSummary(shape: ShapeSummary) {
  if (!session) throw new Error('Canvas session is not open')
  const index = session.shapes.findIndex((item) => item.id === shape.id)
  if (index >= 0) session.shapes[index] = shape
  else session.shapes.push(shape)
}

function selectShapeSummary(shape: ShapeSummary) {
  if (!session) throw new Error('Canvas session is not open')
  session.selection = {
    canvasId: session.canvasId,
    pageId: session.metadata.activePageId,
    selectedShapeIds: [shape.id],
    shapes: [shape]
  }
}

function queuePendingOperation(
  type: CanvasPendingOperation['type'],
  payload: Record<string, unknown>
) {
  if (!session) throw new Error('Canvas session is not open')
  const operation: CanvasPendingOperation = {
    id: slugId('op'),
    type,
    payload,
    createdAt: nowIso()
  }
  session.pendingOperations.push(operation)
  return operation
}

async function copyImageIntoCanvas(imagePath: string) {
  if (!session) throw new Error('Canvas session is not open')
  const source = path.resolve(imagePath)
  await access(source)
  const safeName = path.basename(source).replace(/[^a-zA-Z0-9._-]/g, '_')
  const ext = path.extname(safeName) || '.png'
  const targetName = `${path.basename(safeName, ext)}_${Date.now()}${ext}`
  const targetPath = path.join(session.storagePath, 'assets/images', targetName)
  ensureInside(session.storagePath, targetPath)
  await copyFile(source, targetPath)
  return {
    absolutePath: targetPath,
    assetPath: `assets/images/${targetName}`,
    assetUrl: `/api/canvas/asset-file/images/${encodeURIComponent(targetName)}`
  }
}

async function writeRun(record: Omit<RunRecord, 'createdAt'>) {
  if (!session) throw new Error('Canvas session is not open')
  const createdAt = nowIso()
  const run: RunRecord = { ...record, createdAt }
  await writeJson(path.join(session.storagePath, 'runs', `${record.runId}.json`), run)
  return run
}

async function createImageHolderOffline(payload: Record<string, unknown>) {
  if (!session) throw new Error('Canvas session is not open')
  const shapeId = String(payload.shapeId ?? makeShapeId('holder'))
  const x = Number(payload.x ?? 100)
  const y = Number(payload.y ?? 100)
  const w = Number(payload.w ?? 403)
  const h = Number(payload.h ?? 567)
  const label = String(payload.label ?? 'AI 图片')
  const aspectRatio = String(payload.aspectRatio ?? '5:7')
  const shape: ShapeSummary = {
    id: shapeId,
    type: 'geo',
    role: 'image_holder',
    bounds: { x, y, w, h },
    text: label,
    color: 'blue',
    aspectRatio,
    meta: {
      aiCanvasRole: 'image_holder',
      aspectRatio,
      acceptsGeneratedImage: true,
      title: label
    }
  }
  upsertShapeSummary(shape)
  selectShapeSummary(shape)
  queuePendingOperation('create_image_holder', {
    ...payload,
    shapeId,
    x,
    y,
    w,
    h,
    label,
    aspectRatio
  })
  await persistSession()
  return { shapeId, bounds: shape.bounds, pendingSync: true }
}

async function insertImageIntoHolderOffline(payload: Record<string, unknown>) {
  if (!session) throw new Error('Canvas session is not open')
  const holderShapeId = String(payload.holderShapeId)
  const holder = session.shapes.find((shape) => shape.id === holderShapeId)
  if (!holder) throw new Error(`Holder not found: ${holderShapeId}`)
  const imageShapeId = String(payload.imageShapeId ?? makeShapeId('image'))
  const title = String(payload.title ?? holder.meta?.title ?? 'AI 图片')
  const shape: ShapeSummary = {
    id: imageShapeId,
    type: 'image',
    role: 'ai_image',
    bounds: holder.bounds,
    assetPath: String(payload.assetPath),
    assetUrl: String(payload.assetUrl),
    version: 1,
    meta: {
      aiCanvasRole: 'ai_image',
      holderId: holderShapeId,
      sourceRunId: payload.runId ? String(payload.runId) : undefined,
      version: 1,
      assetPath: String(payload.assetPath),
      title
    }
  }
  upsertShapeSummary(shape)
  selectShapeSummary(shape)
  queuePendingOperation('insert_image_into_holder', {
    ...payload,
    holderShapeId,
    imageShapeId,
    title
  })
  await persistSession()
  return {
    imageShapeId,
    assetId: undefined,
    assetPath: payload.assetPath,
    bounds: holder.bounds,
    version: 1,
    pendingSync: true
  }
}

async function createImageVersionOffline(payload: Record<string, unknown>) {
  if (!session) throw new Error('Canvas session is not open')
  const sourceShapeId = String(payload.sourceShapeId)
  const source = session.shapes.find((shape) => shape.id === sourceShapeId)
  if (!source) throw new Error(`Source image not found: ${sourceShapeId}`)
  const sourceVersion = Number(source.version ?? source.meta?.version ?? 1)
  const version = sourceVersion + 1
  const placement = String(payload.placement ?? 'right')
  const x = placement === 'replace' ? source.bounds.x : source.bounds.x + source.bounds.w + 80
  const y = source.bounds.y
  const newShapeId = String(payload.newShapeId ?? makeShapeId('image'))
  const arrowShapeId = String(payload.arrowShapeId ?? makeShapeId('version_arrow'))
  const title = String(payload.title ?? `AI 图片 v${version}`)
  const imageShape: ShapeSummary = {
    id: newShapeId,
    type: 'image',
    role: 'ai_image',
    bounds: { x, y, w: source.bounds.w, h: source.bounds.h },
    assetPath: String(payload.assetPath),
    assetUrl: String(payload.assetUrl),
    version,
    parentShapeId: sourceShapeId,
    meta: {
      aiCanvasRole: 'ai_image',
      holderId: source.meta?.holderId,
      parentShapeId: sourceShapeId,
      sourceRunId: payload.runId ? String(payload.runId) : undefined,
      version,
      assetPath: String(payload.assetPath),
      title
    }
  }
  const arrowShape: ShapeSummary = {
    id: arrowShapeId,
    type: 'arrow',
    role: 'version_group',
    bounds: {
      x: source.bounds.x + source.bounds.w + 20,
      y: source.bounds.y + source.bounds.h / 2,
      w: 42,
      h: 1
    },
    parentShapeId: sourceShapeId,
    arrowStart: {
      x: source.bounds.x + source.bounds.w + 20,
      y: source.bounds.y + source.bounds.h / 2
    },
    arrowEnd: {
      x: source.bounds.x + source.bounds.w + 62,
      y: source.bounds.y + source.bounds.h / 2
    },
    meta: {
      aiCanvasRole: 'version_group',
      parentShapeId: sourceShapeId
    }
  }
  upsertShapeSummary(imageShape)
  upsertShapeSummary(arrowShape)
  selectShapeSummary(imageShape)
  queuePendingOperation('create_image_version', {
    ...payload,
    sourceShapeId,
    newShapeId,
    arrowShapeId,
    title,
    version,
    placement
  })
  await persistSession()
  return {
    newShapeId,
    assetId: undefined,
    assetPath: payload.assetPath,
    version,
    parentShapeId: sourceShapeId,
    pendingSync: true
  }
}

function absoluteCanvasPath(relativePath?: string) {
  if (!session || !relativePath) return undefined
  const absolute = path.join(session.storagePath, relativePath)
  ensureInside(session.storagePath, absolute)
  return absolute
}

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function renderExportSvg(shapeIds?: string[]) {
  if (!session) throw new Error('Canvas session is not open')
  const selected = shapeIds?.length
    ? session.shapes.filter((shape) => shapeIds.includes(shape.id))
    : session.shapes
  const shapes = selected.length > 0 ? selected : session.shapes
  const minX = Math.min(...shapes.map((shape) => shape.bounds.x), 0)
  const minY = Math.min(...shapes.map((shape) => shape.bounds.y), 0)
  const maxX = Math.max(...shapes.map((shape) => shape.bounds.x + shape.bounds.w), 1200)
  const maxY = Math.max(...shapes.map((shape) => shape.bounds.y + shape.bounds.h), 800)
  const pad = 80
  const width = maxX - minX + pad * 2
  const height = maxY - minY + pad * 2
  const offsetX = -minX + pad
  const offsetY = -minY + pad
  const body = shapes
    .map((shape) => {
      const x = shape.bounds.x + offsetX
      const y = shape.bounds.y + offsetY
      if (shape.type === 'image' && shape.assetUrl) {
        return `<image href="${escapeXml(shape.assetUrl)}" x="${x}" y="${y}" width="${shape.bounds.w}" height="${shape.bounds.h}" preserveAspectRatio="xMidYMid meet" />`
      }
      if (shape.type === 'arrow' && shape.arrowStart && shape.arrowEnd) {
        return `<line x1="${shape.arrowStart.x + offsetX}" y1="${shape.arrowStart.y + offsetY}" x2="${shape.arrowEnd.x + offsetX}" y2="${shape.arrowEnd.y + offsetY}" stroke="#d92d20" stroke-width="4" marker-end="url(#arrow)" />`
      }
      if (shape.text) {
        return `<text x="${x}" y="${y + 24}" fill="#b42318" font-family="Inter, Arial" font-size="24" font-weight="700">${escapeXml(shape.text)}</text>`
      }
      const stroke = shape.role === 'image_holder' ? '#2563eb' : '#d92d20'
      const dash = shape.role === 'image_holder' ? '8 8' : '4 5'
      return `<rect x="${x}" y="${y}" width="${shape.bounds.w}" height="${shape.bounds.h}" fill="none" stroke="${stroke}" stroke-width="3" stroke-dasharray="${dash}" rx="8" />`
    })
    .join('\n')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#d92d20" />
    </marker>
  </defs>
  <rect width="100%" height="100%" fill="#ffffff" />
  ${body}
</svg>`
}

function canAutoEdit(result: PreparedAnnotationEdit) {
  return Boolean(result.inputImagePath && result.annotationPlan.length > 0 && result.targetShapeId)
}

function touchCodexListener() {
  codexListenerLastSeenAt = nowIso()
}

function isCodexListenerActive() {
  if (!codexListenerLastSeenAt) return false
  return Date.now() - Date.parse(codexListenerLastSeenAt) <= LISTENER_ACTIVE_WINDOW_MS
}

async function prepareAnnotationEditFromBody(body: Record<string, unknown>) {
  if (!session) throw new Error('Canvas session is not open')
  const radius = Number(body?.radius ?? 300)
  const targetShapeId = body?.targetShapeId ? String(body.targetShapeId) : undefined
  const userRequest = body?.userRequest ? String(body.userRequest) : undefined
  const includeScreenshot = body?.includeScreenshot !== false
  const state = statePayload()
  const plan = parseAnnotations({ state, targetShapeId, radius })
  const target = state.shapes.find((shape) => shape.id === plan.targetShapeId)

  if (includeScreenshot && plan.targetShapeId) {
    const exportId = slugId('annotated_view')
    const shapeIds = [
      plan.targetShapeId,
      ...plan.annotationPlan.flatMap((annotation) => annotation.sourceShapeIds)
    ]
    const svg = renderExportSvg(shapeIds)
    const outputPath = path.join(session.storagePath, 'exports', `${exportId}.svg`)
    ensureInside(session.storagePath, outputPath)
    await writeFile(outputPath, svg, 'utf8')
    await writeJson(path.join(session.storagePath, 'exports', `${exportId}.json`), {
      exportId,
      sourceShapeIds: shapeIds,
      outputPath: path.relative(session.storagePath, outputPath),
      createdAt: nowIso()
    })
    plan.screenshotPath = path.relative(session.storagePath, outputPath)
  }

  const result: PreparedAnnotationEdit = {
    ...plan,
    readyToEdit: !plan.needsClarification && Boolean(plan.targetImagePath),
    storagePath: session.storagePath,
    inputImagePath: absoluteCanvasPath(target?.assetPath),
    editPrompt: buildAnnotationEditPrompt({
      userRequest,
      annotations: plan.annotationPlan
    })
  }
  return { result, userRequest }
}

function editRequestPath(requestId: string) {
  if (!session) throw new Error('Canvas session is not open')
  const safeId = requestId.replace(/[^a-zA-Z0-9_-]/g, '_')
  const targetPath = path.join(session.storagePath, 'requests', `${safeId}.json`)
  ensureInside(session.storagePath, targetPath)
  return targetPath
}

async function writeEditRequest(request: CanvasEditRequest) {
  request.updatedAt = nowIso()
  await writeJson(editRequestPath(request.requestId), request)
  if (!session) throw new Error('Canvas session is not open')
  await writeJson(path.join(session.storagePath, 'requests', 'pending_edit.json'), request)
  return request
}

async function readEditRequest(requestId: string) {
  return readJson<CanvasEditRequest>(editRequestPath(requestId))
}

async function listEditRequests(status?: EditRequestStatus) {
  if (!session) throw new Error('Canvas session is not open')
  const requestDir = path.join(session.storagePath, 'requests')
  const names = await readdir(requestDir)
  const requests = (
    await Promise.all(
      names
        .filter((name) => name.startsWith('edit_') && name.endsWith('.json'))
        .map((name) => readJson<CanvasEditRequest>(path.join(requestDir, name)))
    )
  ).filter(Boolean) as CanvasEditRequest[]
  return requests
    .filter((request) => (status ? request.status === status : true))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

async function editRequestQueueStatus(): Promise<EditRequestQueueStatus> {
  const requests = await listEditRequests()
  const queuedCount = requests.filter((request) => request.status === 'queued').length
  const processingCount = requests.filter((request) => request.status === 'processing').length
  return {
    listenerActive: isCodexListenerActive(),
    listenerLastSeenAt: codexListenerLastSeenAt,
    listenerActiveWindowMs: LISTENER_ACTIVE_WINDOW_MS,
    queuedCount,
    processingCount,
    latestRequest: requests.at(-1),
    updatedAt: nowIso()
  }
}

async function start() {
  const args = parseArgs(process.argv.slice(2))
  const port = Number(args.get('port') ?? process.env.AI_CANVAS_PORT ?? DEFAULT_PORT)
  await openSession({
    workspaceRoot: args.get('workspace-root') ?? process.env.AI_CANVAS_WORKSPACE_ROOT,
    canvasId: args.get('canvas-id') ?? process.env.AI_CANVAS_CANVAS_ID
  })

  const app = express()
  const server = createServer(app)
  const wss = new WebSocketServer({ server, path: '/ws' })

  app.use(express.json({ limit: '25mb' }))

  app.get('/api/health', (_request, response) => {
    response.json({
      ok: true,
      appVersion: APP_VERSION,
      features: FEATURES,
      pluginRoot,
      clientIndexReady: existsSync(clientIndex),
      canvasId: session?.canvasId,
      storagePath: session?.storagePath
    })
  })

  app.post('/api/canvas/open', async (request, response, next) => {
    try {
      const nextSession = await openSession(request.body ?? {})
      response.json({
        url: `http://127.0.0.1:${port}/`,
        canvasId: nextSession.canvasId,
        storagePath: nextSession.storagePath
      })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/canvas/state', (_request, response, next) => {
    try {
      response.json(statePayload())
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/canvas/selection', (_request, response, next) => {
    try {
      response.json(statePayload().selection)
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/canvas/shape', async (request, response, next) => {
    try {
      const result = hasCanvasClient()
        ? await sendCommand('create_image_holder', request.body ?? {})
        : await createImageHolderOffline(request.body ?? {})
      await persistSession()
      response.json(result)
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/canvas/asset', async (request, response, next) => {
    try {
      const copied = await copyImageIntoCanvas(String(request.body.imagePath))
      const runId = slugId('run')
      const commandPayload = {
        ...request.body,
        ...copied,
        runId
      }
      const result = hasCanvasClient()
        ? await sendCommand('insert_image_into_holder', commandPayload)
        : await insertImageIntoHolderOffline(commandPayload)
      const run = await writeRun({
        runId,
        type: 'insert_image_into_holder',
        model: 'external',
        input: {
          holderShapeId: request.body.holderShapeId,
          imagePath: request.body.imagePath
        },
        output: result as Record<string, unknown>
      })
      await persistSession()
      response.json({ ...(result as object), runId: run.runId, assetPath: copied.assetPath })
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/canvas/version', async (request, response, next) => {
    try {
      const copied = await copyImageIntoCanvas(String(request.body.imagePath))
      const runId = request.body.runId ?? slugId('run')
      const commandPayload = {
        ...request.body,
        ...copied,
        runId
      }
      const result = hasCanvasClient()
        ? await sendCommand('create_image_version', commandPayload)
        : await createImageVersionOffline(commandPayload)
      await writeRun({
        runId,
        type: 'create_image_version',
        model: 'external',
        input: {
          sourceShapeId: request.body.sourceShapeId,
          imagePath: request.body.imagePath
        },
        output: result as Record<string, unknown>
      })
      await persistSession()
      response.json({ ...(result as object), runId, assetPath: copied.assetPath })
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/canvas/export', async (request, response, next) => {
    try {
      if (!session) throw new Error('Canvas session is not open')
      const exportId = slugId('export')
      const svg = renderExportSvg(request.body?.shapeIds)
      const outputPath = path.join(session.storagePath, 'exports', `${exportId}.svg`)
      ensureInside(session.storagePath, outputPath)
      await writeFile(outputPath, svg, 'utf8')
      await writeJson(path.join(session.storagePath, 'exports', `${exportId}.json`), {
        exportId,
        sourceShapeIds: request.body?.shapeIds ?? [],
        outputPath: path.relative(session.storagePath, outputPath),
        createdAt: nowIso()
      })
      response.json({
        exportId,
        screenshotPath: path.relative(session.storagePath, outputPath),
        absolutePath: outputPath
      })
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/canvas/prepare-edit', async (request, response, next) => {
    try {
      if (!session) throw new Error('Canvas session is not open')
      const { result } = await prepareAnnotationEditFromBody(request.body ?? {})
      await writeJson(path.join(session.storagePath, 'requests', 'pending_edit.json'), {
        ...result,
        createdAt: nowIso(),
        codexInstruction: '要求后续变更'
      })
      response.json(result)
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/canvas/edit-request', async (request, response, next) => {
    try {
      if (!session) throw new Error('Canvas session is not open')
      const { result, userRequest } = await prepareAnnotationEditFromBody(request.body ?? {})
      const requestId = slugId('edit')
      const autoEdit = canAutoEdit(result)
      const createdAt = nowIso()
      const editRequest: CanvasEditRequest = {
        ...result,
        requestId,
        status: autoEdit ? 'queued' : 'needs_clarification',
        canAutoEdit: autoEdit,
        source: 'canvas_button',
        userRequest,
        codexInstruction:
          'AI Canvas 手动提交的标注修图任务：用户已经完成一批画布标注，请根据这些标注修改当前图片，新图放右侧，旧图保留。',
        attempts: 0,
        createdAt,
        updatedAt: createdAt
      }
      response.json(await writeEditRequest(editRequest))
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/canvas/edit-requests/next', async (request, response, next) => {
    try {
      if (!session) throw new Error('Canvas session is not open')
      touchCodexListener()
      const includeCompleted = request.body?.includeCompleted === true
      const queued = await listEditRequests('queued')
      let editRequest =
        queued[0] ?? (includeCompleted ? (await listEditRequests()).find((item) => item.status !== 'processing') : undefined)
      if (editRequest && request.body?.claim !== false && editRequest.status === 'queued') {
        editRequest = await writeEditRequest({
          ...editRequest,
          status: 'processing',
          attempts: editRequest.attempts + 1,
          claimedAt: nowIso()
        })
      }
      response.json({
        request: editRequest,
        timedOut: false,
        message: editRequest ? 'Edit request ready.' : 'No queued edit request.'
      })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/canvas/edit-requests/status', async (_request, response, next) => {
    try {
      response.json(await editRequestQueueStatus())
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/canvas/edit-requests/:requestId', async (request, response, next) => {
    try {
      const editRequest = await readEditRequest(request.params.requestId)
      if (!editRequest) {
        response.status(404).json({ ok: false, error: 'Edit request not found' })
        return
      }
      response.json(editRequest)
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/canvas/edit-requests/:requestId/status', async (request, response, next) => {
    try {
      touchCodexListener()
      const editRequest = await readEditRequest(request.params.requestId)
      if (!editRequest) {
        response.status(404).json({ ok: false, error: 'Edit request not found' })
        return
      }
      const status = String(request.body?.status ?? editRequest.status) as EditRequestStatus
      const nextRequest = await writeEditRequest({
        ...editRequest,
        status,
        error: request.body?.error ? String(request.body.error) : editRequest.error,
        result:
          request.body?.result && typeof request.body.result === 'object'
            ? (request.body.result as Record<string, unknown>)
            : editRequest.result,
        completedAt:
          status === 'completed' || status === 'failed' || status === 'needs_clarification'
            ? nowIso()
            : editRequest.completedAt
      })
      response.json(nextRequest)
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/canvas/save', async (_request, response, next) => {
    try {
      if (clients.size > 0) {
        await sendCommand('save_snapshot', {})
      }
      await persistSession()
      response.json({
        ok: true,
        savedAt: nowIso(),
        snapshotPath: 'canvas.json'
      })
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/canvas/pending-operations/clear', async (request, response, next) => {
    try {
      if (!session) throw new Error('Canvas session is not open')
      const ids = Array.isArray(request.body?.ids)
        ? new Set(request.body.ids.map((id: unknown) => String(id)))
        : undefined
      session.pendingOperations = ids
        ? session.pendingOperations.filter((operation) => !ids.has(operation.id))
        : []
      await persistSession()
      response.json({
        ok: true,
        remaining: session.pendingOperations.length
      })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/canvas/asset-file/images/:name', async (request, response, next) => {
    try {
      if (!session) throw new Error('Canvas session is not open')
      const filePath = path.join(session.storagePath, 'assets/images', request.params.name)
      ensureInside(session.storagePath, filePath)
      response.sendFile(filePath)
    } catch (error) {
      next(error)
    }
  })

  wss.on('connection', (socket) => {
    clients.add(socket)
    socket.send(JSON.stringify({ type: 'server:state', payload: session ? statePayload() : null }))

    socket.on('message', async (raw) => {
      try {
        const message = JSON.parse(String(raw)) as {
          type: string
          id?: string
          ok?: boolean
          result?: unknown
          error?: string
          payload?: Partial<CanvasStatePayload>
        }

        if (message.type === 'client:state' && session && message.payload) {
          session.snapshot = message.payload.snapshot
          session.shapes = message.payload.shapes ?? []
          session.selection = message.payload.selection ?? session.selection
          await persistSession()
          return
        }

        if (message.type === 'response' && message.id) {
          const pending = pendingCommands.get(message.id)
          if (!pending) return
          clearTimeout(pending.timer)
          pendingCommands.delete(message.id)
          if (message.ok) pending.resolve(message.result)
          else pending.reject(new Error(message.error ?? 'Canvas command failed'))
        }
      } catch (error) {
        console.error('[ai-canvas] ws message error', error)
      }
    })

    socket.on('close', () => {
      clients.delete(socket)
    })
  })

  if (process.env.NODE_ENV === 'production' && (await exists(clientIndex))) {
    app.use(express.static(clientDist))
    app.get('*', (_request, response) => response.sendFile(clientIndex))
  } else {
    const { createServer: createViteServer } = await import('vite')
    const vite = await createViteServer({
      root: path.resolve(pluginRoot, 'packages/canvas-app'),
      server: { middlewareMode: true, hmr: { server } },
      appType: 'spa'
    })
    app.use(vite.middlewares)
  }

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[ai-canvas] api error', message)
    response.status(500).json({ ok: false, error: message })
  })

  server.listen(port, '127.0.0.1', () => {
    console.error(`[ai-canvas] listening on http://127.0.0.1:${port}/`)
  })
}

start().catch((error) => {
  console.error('[ai-canvas] failed to start', error)
  process.exit(1)
})

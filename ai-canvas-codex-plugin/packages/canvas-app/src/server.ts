import type {
  CanvasAction,
  CanvasActionApplyResult,
  CanvasMetadata,
  CanvasEditRequest,
  CanvasImageImport,
  CanvasImageSource,
  CanvasPendingOperation,
  CanvasStatePayload,
  CanvasGenerationJob,
  CanvasContext,
  EditRequestStatus,
  EditRequestQueueStatus,
  PreparedAnnotationEdit,
  RunRecord,
  CanvasSkillCategory,
  CanvasSkillManifest,
  CanvasSkillRequest,
  CanvasSkillRun,
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

type XiaohongshuCoverBrief = {
  contentType: string
  title: string
  titleStyle: string
  textPlacement: string
  focus: string
  extra?: string
}

type YoutubeThumbnailBrief = {
  videoTopic: string
  title: string
  audience: string
  thumbnailStyle: string
  textPlacement: string
  focus: string
  extra?: string
}

type CrossPlatformAdaptBrief = {
  campaignGoal: string
  platforms: string[]
  contentKind: string
  preserve: string
  backgroundStrategy: string
  textPolicy: string
  extra?: string
}

type CrossPlatformSpec = {
  id: string
  name: string
  aspectRatio: string
  note: string
  longSide: number
  standard: string
  safeArea: string
  guidance: string[]
}

type ProductMarketingPlatformId =
  | 'amazon_listing'
  | 'shopify_store'
  | 'meta_ads'
  | 'google_display'
  | 'general_ecommerce'

type ProductMarketingBrief = {
  platform: ProductMarketingPlatformId
  productName: string
  targetAudience: string
  sellingPoints: string
  brandTone: string
  imageCount: number | 'platform_default'
  extra?: string
}

type ProductMarketingOutputSpec = {
  id: string
  title: string
  aspectRatio: string
  note: string
  longSide: number
  guidance: string[]
}

type ProductMarketingPlatformSpec = {
  id: ProductMarketingPlatformId
  name: string
  standards: string[]
  recipes: ProductMarketingOutputSpec[]
}

type LogoBrandBrief = {
  brandName: string
  industry: string
  targetAudience: string
  positioning: string
  personality: string
  logoStyle: string
  usageContexts: string
  outputCount: number | 'platform_default'
  extra?: string
}

type LogoBrandOutputSpec = {
  id: string
  title: string
  aspectRatio: string
  note: string
  longSide: number
  guidance: string[]
}

type MarketingBrochureFormatId =
  | 'trifold_brochure'
  | 'service_brochure'
  | 'event_campaign'
  | 'product_brochure'

type MarketingBrochureBrief = {
  format: MarketingBrochureFormatId
  campaignName: string
  brandName: string
  targetAudience: string
  keyMessage: string
  offer: string
  callToAction: string
  visualTone: string
  outputCount: number | 'platform_default'
  extra?: string
}

type MarketingBrochureOutputSpec = {
  id: string
  title: string
  aspectRatio: string
  note: string
  longSide: number
  guidance: string[]
}

const APP_VERSION = '0.1.0'
const FEATURES = [
  'annotationEditRequests',
  'editRequestQueue',
  'offlineCanvasSync',
  'imageImport',
  'canvasActions',
  'skillHost'
]
const LISTENER_ACTIVE_WINDOW_MS = 75_000
const MAX_IMPORT_BYTES = 15 * 1024 * 1024
const URL_IMPORT_TIMEOUT_MS = 20_000
const DEFAULT_PORT = Number(process.env.AI_CANVAS_PORT ?? 43218)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pluginRoot = findPluginRoot(__dirname)
const clientDist = path.resolve(pluginRoot, 'packages/canvas-app/dist/client')
const clientIndex = path.join(clientDist, 'index.html')
const pendingCommands = new Map<string, PendingCommand>()
const clients = new Set<WebSocket>()
let activeClient: WebSocket | undefined

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
  await mkdir(path.join(storagePath, 'imports'), { recursive: true })
  await mkdir(path.join(storagePath, 'requests'), { recursive: true })
  await mkdir(path.join(storagePath, 'skill-runs'), { recursive: true })
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

  const target =
    activeClient && activeClient.readyState === WebSocket.OPEN
      ? activeClient
      : openClients[openClients.length - 1]
  const id = nanoid()
  const message = JSON.stringify({ type: 'command', id, command, payload })
  const promise = new Promise<unknown>((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingCommands.delete(id)
      reject(new Error(`Canvas command timed out: ${command}`))
    }, 12_000)
    pendingCommands.set(id, { resolve, reject, timer })
  })
  target.send(message)
  return promise
}

function hasCanvasClient() {
  return [...clients].some((client) => client.readyState === WebSocket.OPEN)
}

function makeShapeId(prefix: string) {
  return `shape:${prefix}_${nanoid(8)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function numberOrUndefined(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

function displaySize(width: number, height: number, maxSize = 520) {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 1024
  const safeHeight = Number.isFinite(height) && height > 0 ? height : 1024
  const scale = Math.min(1, maxSize / Math.max(safeWidth, safeHeight))
  return {
    w: Math.max(80, Math.round(safeWidth * scale)),
    h: Math.max(80, Math.round(safeHeight * scale))
  }
}

function defaultImportPosition(width: number, height: number, payload: Record<string, unknown>) {
  const size = {
    w: numberOrUndefined(payload.w) ?? displaySize(width, height).w,
    h: numberOrUndefined(payload.h) ?? displaySize(width, height).h
  }
  const explicitX = numberOrUndefined(payload.x)
  const explicitY = numberOrUndefined(payload.y)
  if (explicitX !== undefined && explicitY !== undefined) {
    return { x: explicitX, y: explicitY, ...size }
  }
  const selected = session?.selection.shapes[0]
  if (selected && String(payload.placement ?? 'selection_right') === 'selection_right') {
    return {
      x: selected.bounds.x + selected.bounds.w + 80,
      y: selected.bounds.y,
      ...size
    }
  }
  return { x: 120, y: 100, ...size }
}

function detectImageMime(buffer: Buffer, name = '') {
  const lowerName = name.toLowerCase()
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png'
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'image/jpeg'
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp'
  }
  if (lowerName.endsWith('.png')) return 'image/png'
  if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) return 'image/jpeg'
  if (lowerName.endsWith('.webp')) return 'image/webp'
  return undefined
}

function extensionForMime(mimeType?: string) {
  if (mimeType === 'image/png') return '.png'
  if (mimeType === 'image/jpeg') return '.jpg'
  if (mimeType === 'image/webp') return '.webp'
  return '.png'
}

function readPngDimensions(buffer: Buffer) {
  if (buffer.length < 24) return undefined
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  }
}

function readJpegDimensions(buffer: Buffer) {
  let offset = 2
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) return undefined
    const marker = buffer[offset + 1]
    const length = buffer.readUInt16BE(offset + 2)
    if (length < 2) return undefined
    if (
      marker === 0xc0 ||
      marker === 0xc1 ||
      marker === 0xc2 ||
      marker === 0xc3 ||
      marker === 0xc5 ||
      marker === 0xc6 ||
      marker === 0xc7 ||
      marker === 0xc9 ||
      marker === 0xca ||
      marker === 0xcb ||
      marker === 0xcd ||
      marker === 0xce ||
      marker === 0xcf
    ) {
      return {
        width: buffer.readUInt16BE(offset + 7),
        height: buffer.readUInt16BE(offset + 5)
      }
    }
    offset += 2 + length
  }
  return undefined
}

function readWebpDimensions(buffer: Buffer) {
  const chunk = buffer.subarray(12, 16).toString('ascii')
  if (chunk === 'VP8X' && buffer.length >= 30) {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3)
    }
  }
  if (chunk === 'VP8 ' && buffer.length >= 30) {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff
    }
  }
  if (chunk === 'VP8L' && buffer.length >= 25) {
    const bits = buffer.readUInt32LE(21)
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1
    }
  }
  return undefined
}

function readImageDimensionsFromBuffer(buffer: Buffer, mimeType?: string) {
  const dimensions =
    mimeType === 'image/png'
      ? readPngDimensions(buffer)
      : mimeType === 'image/jpeg'
        ? readJpegDimensions(buffer)
        : mimeType === 'image/webp'
          ? readWebpDimensions(buffer)
          : undefined
  return dimensions ?? { width: 1024, height: 1024 }
}

function assertSupportedImage(buffer: Buffer, name = '') {
  if (buffer.byteLength > MAX_IMPORT_BYTES) {
    throw new Error(`Image is too large. Maximum size is ${Math.round(MAX_IMPORT_BYTES / 1024 / 1024)}MB.`)
  }
  const mimeType = detectImageMime(buffer, name)
  if (!mimeType) {
    throw new Error('Unsupported image format. Use png, jpg, jpeg, or webp.')
  }
  return mimeType
}

function assertSafeImageUrl(rawUrl: string) {
  const parsed = new URL(rawUrl)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http and https image URLs are supported.')
  }
  const host = parsed.hostname.toLowerCase()
  if (
    host === 'localhost' ||
    host === '::1' ||
    host === '0.0.0.0' ||
    host.startsWith('127.') ||
    host.startsWith('10.') ||
    host.startsWith('192.168.') ||
    host.startsWith('169.254.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  ) {
    throw new Error('Private or localhost image URLs are not supported.')
  }
  return parsed
}

function parseDataUrl(dataUrl: string) {
  const match = /^data:([^;,]+);base64,(.+)$/s.exec(dataUrl)
  if (!match) throw new Error('Expected a base64 image data URL.')
  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64')
  }
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

async function writeImageBufferIntoCanvas(input: {
  buffer: Buffer
  source: CanvasImageSource
  originalName?: string
  originalUrl?: string
  inputPath?: string
}) {
  if (!session) throw new Error('Canvas session is not open')
  const mimeType = assertSupportedImage(input.buffer, input.originalName ?? input.originalUrl ?? 'image')
  const dimensions = readImageDimensionsFromBuffer(input.buffer, mimeType)
  const importId = slugId('import')
  const baseName = (input.originalName ?? input.originalUrl?.split('/').pop() ?? importId).replace(
    /[^a-zA-Z0-9._-]/g,
    '_'
  )
  const ext = extensionForMime(mimeType)
  const targetName = `${path.basename(baseName, path.extname(baseName)) || importId}_${Date.now()}${ext}`
  const targetPath = path.join(session.storagePath, 'assets/images', targetName)
  ensureInside(session.storagePath, targetPath)
  await writeFile(targetPath, input.buffer)
  const assetPath = `assets/images/${targetName}`
  const assetUrl = `/api/canvas/asset-file/images/${encodeURIComponent(targetName)}`
  const createdAt = nowIso()
  const record: CanvasImageImport = {
    importId,
    canvasId: session.canvasId,
    source: input.source,
    originalName: input.originalName,
    originalUrl: input.originalUrl,
    inputPath: input.inputPath,
    assetPath,
    assetUrl,
    width: dimensions.width,
    height: dimensions.height,
    mimeType,
    createdAt
  }
  await writeJson(path.join(session.storagePath, 'imports', `${importId}.json`), record)
  return {
    record,
    absolutePath: targetPath
  }
}

async function readImportFile(inputPath: string) {
  const absolutePath = path.resolve(inputPath)
  await access(absolutePath)
  const buffer = await readFile(absolutePath)
  return {
    buffer,
    absolutePath,
    originalName: path.basename(absolutePath)
  }
}

async function fetchImportUrl(rawUrl: string) {
  const parsed = assertSafeImageUrl(rawUrl)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), URL_IMPORT_TIMEOUT_MS)
  try {
    const response = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: { Accept: 'image/png,image/jpeg,image/webp' }
    })
    if (!response.ok) throw new Error(`Image URL returned HTTP ${response.status}.`)
    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()
    if (contentType && !['image/png', 'image/jpeg', 'image/webp'].includes(contentType)) {
      throw new Error('Image URL did not return a supported image content type.')
    }
    const length = Number(response.headers.get('content-length') ?? 0)
    if (length > MAX_IMPORT_BYTES) {
      throw new Error(`Image is too large. Maximum size is ${Math.round(MAX_IMPORT_BYTES / 1024 / 1024)}MB.`)
    }
    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.byteLength > MAX_IMPORT_BYTES) {
      throw new Error(`Image is too large. Maximum size is ${Math.round(MAX_IMPORT_BYTES / 1024 / 1024)}MB.`)
    }
    return {
      buffer,
      originalName: path.basename(parsed.pathname) || 'url-image',
      url: parsed.toString()
    }
  } finally {
    clearTimeout(timer)
  }
}

function importedImageShape(payload: Record<string, unknown>): ShapeSummary {
  const width = Number(payload.imageWidth ?? payload.width ?? 1024)
  const height = Number(payload.imageHeight ?? payload.height ?? 1024)
  const bounds = {
    ...defaultImportPosition(width, height, payload),
    w: numberOrUndefined(payload.w) ?? defaultImportPosition(width, height, payload).w,
    h: numberOrUndefined(payload.h) ?? defaultImportPosition(width, height, payload).h
  }
  const title = String(payload.title ?? '外部导入图片')
  const shapeId = String(payload.imageShapeId ?? makeShapeId('image'))
  return {
    id: shapeId,
    type: 'image',
    role: 'ai_image',
    bounds,
    assetPath: String(payload.assetPath),
    assetUrl: String(payload.assetUrl),
    version: 1,
    meta: {
      aiCanvasRole: 'ai_image',
      assetPath: String(payload.assetPath),
      assetUrl: String(payload.assetUrl),
      imageSource: String(payload.imageSource ?? 'upload') as CanvasImageSource,
      importId: payload.importId ? String(payload.importId) : undefined,
      usableAsSkillInput: true,
      title
    }
  }
}

async function importImageOffline(payload: Record<string, unknown>) {
  const shape = importedImageShape(payload)
  upsertShapeSummary(shape)
  if (payload.selectAfterCreate !== false) selectShapeSummary(shape)
  queuePendingOperation('import_image', {
    ...payload,
    imageShapeId: shape.id,
    x: shape.bounds.x,
    y: shape.bounds.y,
    w: shape.bounds.w,
    h: shape.bounds.h
  })
  await persistSession()
  return {
    importId: payload.importId,
    shapeId: shape.id,
    imageShapeId: shape.id,
    assetPath: shape.assetPath,
    assetUrl: shape.assetUrl,
    bounds: shape.bounds,
    pendingSync: true
  }
}

async function importCanvasImage(input: {
  buffer: Buffer
  source: CanvasImageSource
  originalName?: string
  originalUrl?: string
  inputPath?: string
  payload: Record<string, unknown>
}) {
  const written = await writeImageBufferIntoCanvas(input)
  const shapeId = String(input.payload.imageShapeId ?? makeShapeId('image'))
  const commandPayload = {
    ...input.payload,
    importId: written.record.importId,
    imageShapeId: shapeId,
    assetPath: written.record.assetPath,
    assetUrl: written.record.assetUrl,
    imageSource: input.source,
    imageWidth: written.record.width,
    imageHeight: written.record.height,
    mimeType: written.record.mimeType,
    title: input.payload.title ?? input.originalName ?? '外部导入图片'
  }
  const result = hasCanvasClient()
    ? await sendCommand('import_image', commandPayload)
    : await importImageOffline(commandPayload)
  written.record.createdShapeId = String((result as Record<string, unknown>).imageShapeId ?? shapeId)
  await writeJson(path.join(session!.storagePath, 'imports', `${written.record.importId}.json`), written.record)
  const runId = slugId('run')
  await writeRun({
    runId,
    type: 'import_image',
    model: 'external',
    input: {
      source: input.source,
      originalName: input.originalName,
      originalUrl: input.originalUrl,
      inputPath: input.inputPath
    },
    output: result as Record<string, unknown>
  })
  await persistSession()
  return {
    ...(result as Record<string, unknown>),
    importId: written.record.importId,
    runId,
    shapeId: written.record.createdShapeId,
    assetPath: written.record.assetPath,
    assetUrl: written.record.assetUrl,
    width: written.record.width,
    height: written.record.height,
    message: '图片已导入画布，并已选中。'
  }
}

async function prepareCanvasActions(actions: CanvasAction[]) {
  const prepared: CanvasAction[] = []
  for (const action of actions) {
    const payload = { ...(action.payload ?? {}) }
    if (
      (action.type === 'place_image' || action.type === 'create_version') &&
      typeof payload.imagePath === 'string' &&
      !payload.assetPath
    ) {
      const copied = await copyImageIntoCanvas(payload.imagePath)
      Object.assign(payload, copied)
    }
    if (action.type === 'import_image' && typeof payload.inputPath === 'string' && !payload.assetPath) {
      const file = await readImportFile(payload.inputPath)
      const written = await writeImageBufferIntoCanvas({
        buffer: file.buffer,
        source: (payload.imageSource ?? payload.source ?? 'upload') as CanvasImageSource,
        originalName: payload.title ? String(payload.title) : file.originalName,
        inputPath: file.absolutePath
      })
      Object.assign(payload, {
        importId: written.record.importId,
        assetPath: written.record.assetPath,
        assetUrl: written.record.assetUrl,
        imageSource: written.record.source,
        imageWidth: written.record.width,
        imageHeight: written.record.height,
        mimeType: written.record.mimeType,
        imageShapeId: payload.imageShapeId ?? makeShapeId('image')
      })
    }
    prepared.push({ ...action, payload })
  }
  return prepared
}

async function applyCanvasActions(actions: CanvasAction[]): Promise<CanvasActionApplyResult> {
  const prepared = await prepareCanvasActions(actions)
  if (hasCanvasClient()) {
    const result = await sendCommand('apply_canvas_actions', { actions: prepared })
    await writeRun({
      runId: slugId('run'),
      type: 'apply_canvas_actions',
      model: 'external',
      input: { actionCount: prepared.length },
      output: result as Record<string, unknown>
    })
    await persistSession()
    return result as CanvasActionApplyResult
  }
  queuePendingOperation('apply_canvas_actions', { actions: prepared })
  await writeRun({
    runId: slugId('run'),
    type: 'apply_canvas_actions',
    model: 'external',
    input: { actionCount: prepared.length },
    output: { pendingSync: true }
  })
  await persistSession()
  return {
    applied: true,
    actionCount: prepared.length,
    results: prepared.map((action) => ({ actionId: action.id, pendingSync: true }))
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
  const explicitX = typeof payload.x === 'number' && Number.isFinite(payload.x) ? payload.x : undefined
  const explicitY = typeof payload.y === 'number' && Number.isFinite(payload.y) ? payload.y : undefined
  const x = explicitX ?? (placement === 'replace' ? source.bounds.x : source.bounds.x + source.bounds.w + 80)
  const y = explicitY ?? source.bounds.y
  const w = Number(payload.w ?? source.bounds.w)
  const h = Number(payload.h ?? source.bounds.h)
  const newShapeId = String(payload.newShapeId ?? makeShapeId('image'))
  const arrowShapeId = String(payload.arrowShapeId ?? makeShapeId('version_arrow'))
  const title = String(payload.title ?? `AI 图片 v${version}`)
  const imageShape: ShapeSummary = {
    id: newShapeId,
    type: 'image',
    role: 'ai_image',
    bounds: { x, y, w, h },
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
    pendingSync: true,
    bounds: { x, y, w, h }
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

const builtinSkills: CanvasSkillManifest[] = [
  {
    id: 'xiaohongshu-cover',
    name: '小红书封面',
    category: 'social_media',
    description: '根据当前图片和参数直出带字体、配色和版式设计的完整小红书封面。',
    icon: 'book-open',
    entrypoints: ['canvas_selection', 'chat_skill_panel', 'natural_language'],
    inputRequirements: {
      requiresSelection: true,
      acceptedRoles: ['ai_image'],
      acceptedShapeTypes: ['image'],
      optionalTextPrompt: true
    },
    defaults: { aspectRatio: '3:4', variantCount: 1 },
    outputs: ['generation_jobs'],
    capabilities: ['image_generation', 'text_generation', 'layout'],
    priority: 1
  },
  {
    id: 'youtube-thumbnail',
    name: 'YouTube 封面图',
    category: 'social_media',
    description: '基于当前图片生成高识别度的 16:9 YouTube 缩略图方向。',
    icon: 'video',
    entrypoints: ['canvas_selection', 'chat_skill_panel', 'natural_language'],
    inputRequirements: {
      requiresSelection: true,
      acceptedRoles: ['ai_image'],
      acceptedShapeTypes: ['image'],
      optionalTextPrompt: true
    },
    defaults: { aspectRatio: '16:9', variantCount: 3 },
    outputs: ['generation_jobs'],
    capabilities: ['image_generation', 'text_generation', 'layout'],
    priority: 2
  },
  {
    id: 'cross-platform-adapt',
    name: '一键跨平台适配',
    category: 'studio',
    description: '按平台比例、安全区和使用场景重构当前图片。',
    icon: 'layout',
    entrypoints: ['canvas_selection', 'chat_skill_panel', 'natural_language'],
    inputRequirements: {
      requiresSelection: true,
      acceptedRoles: ['ai_image', 'artboard'],
      acceptedShapeTypes: ['image', 'geo'],
      optionalTextPrompt: true,
      requiredFields: ['发布目标', '必须保留']
    },
    defaults: {
      platforms: [
        { name: '小红书', aspectRatio: '3:4' },
        { name: 'Instagram', aspectRatio: '1:1' },
        { name: 'Instagram Story', aspectRatio: '9:16' },
        { name: 'YouTube Thumbnail', aspectRatio: '16:9' },
        { name: 'LinkedIn', aspectRatio: '1.91:1' }
      ]
    },
    outputs: ['generation_jobs', 'canvas_actions'],
    capabilities: ['image_generation', 'layout', 'artboard_generation'],
    priority: 3
  },
  {
    id: 'product-marketing-set',
    name: '产品营销组图',
    category: 'e_commerce',
    description: '按平台规范生成产品主图、卖点图、场景图和细节图。',
    icon: 'shopping-bag',
    entrypoints: ['canvas_selection', 'chat_skill_panel', 'natural_language'],
    inputRequirements: {
      requiresSelection: true,
      acceptedRoles: ['ai_image'],
      acceptedShapeTypes: ['image'],
      optionalTextPrompt: true,
      requiredFields: ['产品名称', '目标用户', '核心卖点']
    },
    defaults: { platform: 'general_ecommerce', variantCount: 5 },
    outputs: ['generation_jobs'],
    capabilities: ['image_generation', 'text_generation', 'layout'],
    priority: 4
  },
  {
    id: 'logo-and-brand',
    name: 'Logo 与品牌',
    category: 'branding',
    description: '从品牌简报生成 Logo 方向、色板、视觉板和应用预览。',
    icon: 'badge',
    entrypoints: ['canvas_selection', 'chat_skill_panel', 'natural_language'],
    inputRequirements: {
      optionalTextPrompt: true,
      requiredFields: ['品牌名', '行业/品类', '目标受众', '定位/差异点']
    },
    defaults: { variantCount: 5 },
    outputs: ['generation_jobs'],
    capabilities: ['image_generation', 'text_generation', 'layout'],
    priority: 5
  },
  {
    id: 'marketing-brochure',
    name: '营销宣传册',
    category: 'marketing',
    description: '生成三折页/服务介绍册的外页、内页、样机和推广图。',
    icon: 'map',
    entrypoints: ['canvas_selection', 'chat_skill_panel', 'natural_language'],
    inputRequirements: {
      optionalTextPrompt: true,
      requiredFields: ['活动/产品', '目标受众', '核心信息', '行动号召']
    },
    defaults: { format: 'trifold_brochure', variantCount: 4 },
    outputs: ['generation_jobs'],
    capabilities: ['image_generation', 'text_generation', 'layout'],
    priority: 6
  }
]

function shapeArea(shape: ShapeSummary) {
  return shape.bounds.w * shape.bounds.h
}

function findPrimarySkillShape(state: CanvasStatePayload) {
  const selectedImages = state.selection.shapes.filter(
    (shape) => shape.role === 'ai_image' || shape.type === 'image'
  )
  if (selectedImages.length) return [...selectedImages].sort((a, b) => shapeArea(b) - shapeArea(a))[0]
  return undefined
}

function nearbyTextShapes(state: CanvasStatePayload, target?: ShapeSummary) {
  if (!target) return []
  const radius = 600
  const targetCenter = {
    x: target.bounds.x + target.bounds.w / 2,
    y: target.bounds.y + target.bounds.h / 2
  }
  return state.shapes.filter((shape) => {
    if (!shape.text || shape.id === target.id) return false
    const center = {
      x: shape.bounds.x + shape.bounds.w / 2,
      y: shape.bounds.y + shape.bounds.h / 2
    }
    return Math.hypot(center.x - targetCenter.x, center.y - targetCenter.y) <= radius
  })
}

function buildCanvasContext(state: CanvasStatePayload): CanvasContext {
  const primaryShape = findPrimarySkillShape(state)
  return {
    canvasId: state.canvasId,
    pageId: state.metadata.activePageId,
    storagePath: state.storagePath,
    selection: {
      selectedShapeIds: state.selection.selectedShapeIds,
      primaryShape,
      shapes: state.selection.shapes
    },
    nearby: {
      texts: nearbyTextShapes(state, primaryShape),
      images: state.shapes.filter((shape) => shape.type === 'image' || shape.role === 'ai_image'),
      artboards: state.shapes.filter((shape) => shape.role === 'artboard')
    },
    project: {}
  }
}

function recommendationScore(skill: CanvasSkillManifest, userRequest: string, hasImage: boolean) {
  const text = userRequest.toLowerCase()
  let score = 0.2
  const reasons: string[] = []
  if (skill.inputRequirements.requiresSelection && hasImage) {
    score += 0.25
    reasons.push('当前已选中图片')
  }
  if (skill.id === 'xiaohongshu-cover' && /(小红书|种草|封面|社媒|social)/i.test(userRequest)) {
    score += 0.55
    reasons.push('匹配小红书/封面意图')
  }
  if (skill.id === 'youtube-thumbnail' && /(youtube|油管|缩略图|thumbnail)/i.test(userRequest)) {
    score += 0.55
    reasons.push('匹配 YouTube 缩略图意图')
  }
  if (
    skill.id === 'cross-platform-adapt' &&
    /(适配|平台|尺寸|比例|扩图|裁切|重构|公众号|推特|twitter|instagram|linkedin|story|reels)/i.test(
      userRequest
    )
  ) {
    score += 0.55
    reasons.push('匹配平台尺寸适配意图')
  }
  if (skill.id === 'product-marketing-set' && /(产品|套图|卖点|主图|电商|amazon|亚马逊)/i.test(userRequest)) {
    score += 0.5
    reasons.push('匹配产品营销组图意图')
  }
  if (skill.id === 'logo-and-brand' && /(logo|品牌|标志|视觉识别|brand)/i.test(userRequest)) {
    score += 0.5
    reasons.push('匹配品牌意图')
  }
  if (skill.id === 'marketing-brochure' && /(营销|宣传册|折页|活动|推广|brochure|campaign|传单|flyer)/i.test(userRequest)) {
    score += 0.5
    reasons.push('匹配营销宣传册意图')
  }
  return {
    confidence: Math.min(0.99, score),
    reason: reasons.join('，') || skill.description
  }
}

function skillInputMissingReason(context: CanvasContext, skill: CanvasSkillManifest) {
  if (!skill.inputRequirements.requiresSelection) return undefined
  const primaryShape = context.selection.primaryShape
  if (!primaryShape) return '请先选中一张图片。'
  return undefined
}

function recommendSkills(input: { userRequest?: string; maxResults?: number }) {
  const state = statePayload()
  const context = buildCanvasContext(state)
  const hasImage = Boolean(context.selection.primaryShape)
  const recommendations = builtinSkills
    .map((skill) => {
      const score = recommendationScore(skill, input.userRequest ?? '', hasImage)
      const missingReason = skillInputMissingReason(context, skill)
      const missingInputs = missingReason ? [missingReason] : undefined
      return {
        skillId: skill.id,
        name: skill.name,
        category: skill.category,
        reason: score.reason,
        confidence: missingInputs ? Math.min(score.confidence, 0.25) : score.confidence,
        missingInputs,
        disabledReason: skill.disabledReason
      }
    })
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, input.maxResults ?? 5)
  return { recommendations, context }
}

function skillRunPath(runId: string) {
  if (!session) throw new Error('Canvas session is not open')
  const safeId = runId.replace(/[^a-zA-Z0-9_-]/g, '_')
  const targetPath = path.join(session.storagePath, 'skill-runs', `${safeId}.json`)
  ensureInside(session.storagePath, targetPath)
  return targetPath
}

async function writeSkillRun(run: CanvasSkillRun) {
  run.updatedAt = nowIso()
  await writeJson(skillRunPath(run.runId), run)
  return run
}

async function readSkillRun(runId: string) {
  return readJson<CanvasSkillRun>(skillRunPath(runId))
}

function parseAspectRatio(aspectRatio: string) {
  const [rawW, rawH] = aspectRatio.split(':').map((part) => Number(part))
  if (Number.isFinite(rawW) && Number.isFinite(rawH) && rawW > 0 && rawH > 0) {
    return rawW / rawH
  }
  return 1
}

function sizeForAspectRatio(aspectRatio: string, longSide = 420) {
  const ratio = parseAspectRatio(aspectRatio)
  if (ratio >= 1) return { w: longSide, h: Math.round(longSide / ratio) }
  return { w: Math.round(longSide * ratio), h: longSide }
}

function skillPromptBase(skill: CanvasSkillManifest, context: CanvasContext, userRequest?: string) {
  const nearbyText = context.nearby.texts.map((shape) => shape.text).filter(Boolean).join(' / ')
  return [
    `Skill：${skill.name}`,
    context.selection.primaryShape ? `参考图片：使用当前选中的画布图片。` : undefined,
    context.selection.primaryShape && !context.selection.primaryShape.assetPath
      ? `注意：当前参考图来自画布普通图片对象，优先按视觉内容规划；如后续需要自动落图，建议用拖拽、粘贴或顶部导入重新导入。`
      : undefined,
    nearbyText ? `画布附近文字：${nearbyText}` : undefined,
    userRequest ? `用户补充要求：${userRequest}` : undefined
  ]
    .filter(Boolean)
    .join('\n')
}

function generationJobsForSkill(run: CanvasSkillRun, skill: CanvasSkillManifest) {
  const primary = run.context.selection.primaryShape
  if (!primary) return []
  const baseX = primary.bounds.x + primary.bounds.w + 80
  const baseY = primary.bounds.y
  const outputDir = path.join(run.context.storagePath, 'assets/images')
  const userRequest = typeof run.input.userRequest === 'string' ? run.input.userRequest : undefined
  const basePrompt = skillPromptBase(skill, run.context, userRequest)
  const jobs: CanvasGenerationJob[] = []

  if (skill.id === 'xiaohongshu-cover') {
    const size = sizeForAspectRatio('3:4', Math.max(420, primary.bounds.h))
    for (let index = 0; index < 3; index += 1) {
      jobs.push({
        jobId: `${run.runId}_job_${index + 1}`,
        aspectRatio: '3:4',
        outputDir,
        outputName: `${run.runId}_xiaohongshu_${index + 1}.png`,
        title: `小红书封面 ${index + 1}`,
        placement: { x: baseX + index * (size.w + 80), y: baseY, ...size },
        note:
          index === 0
            ? '标题清晰，突出点击理由。'
            : index === 1
              ? '更生活方式，适合种草内容。'
              : '更高级克制，强调主体质感。',
        prompt: [
          basePrompt,
          `请基于参考图片生成小红书 3:4 封面。`,
          `方向 ${index + 1}：${index === 0 ? '高点击率中文标题强化' : index === 1 ? '生活方式种草感' : '高级克制质感'}`,
          `要求：主体清晰，中文标题短而有点击理由，避免廉价营销感、错乱文字和水印。`
        ].join('\n')
      })
    }
  }

  if (skill.id === 'youtube-thumbnail') {
    const size = sizeForAspectRatio('16:9', 520)
    for (let index = 0; index < 3; index += 1) {
      jobs.push({
        jobId: `${run.runId}_job_${index + 1}`,
        aspectRatio: '16:9',
        outputDir,
        outputName: `${run.runId}_youtube_${index + 1}.png`,
        title: `YouTube 封面 ${index + 1}`,
        placement: { x: baseX + index * (size.w + 80), y: baseY, ...size },
        note:
          index === 0
            ? '强主体与高对比标题区。'
            : index === 1
              ? '戏剧化构图，强化点击悬念。'
              : '更干净的频道专业感。',
        prompt: [
          basePrompt,
          `请基于参考图片生成 YouTube 16:9 缩略图。`,
          `方向 ${index + 1}：${index === 0 ? '强主体高对比' : index === 1 ? '点击悬念与情绪' : '专业频道质感'}`,
          `要求：缩略图小尺寸仍可读，留出大标题空间，避免错乱文字、水印和杂乱背景。`
        ].join('\n')
      })
    }
  }

  if (skill.id === 'cross-platform-adapt') {
    let x = baseX
    CROSS_PLATFORM_SPECS.slice(0, 5).forEach((platform, index) => {
      const size = sizeForAspectRatio(platform.aspectRatio, platform.longSide)
      jobs.push({
        jobId: `${run.runId}_job_${index + 1}`,
        aspectRatio: platform.aspectRatio,
        outputDir,
        outputName: `${run.runId}_${platform.id}_${index + 1}.png`,
        title: `${platform.name} ${platform.aspectRatio}`,
        placement: { x, y: baseY, ...size },
        note: `${platform.note} ${platform.safeArea}`,
        prompt: [
          basePrompt,
          `请将参考图片智能适配为 ${platform.name} 平台成品视觉，比例 ${platform.aspectRatio}。`,
          `平台标准：${platform.standard}`,
          `安全区：${platform.safeArea}`,
          `执行要求：${platform.guidance.join(' ')}`,
          `要求：主体不被裁坏，必要时扩图或重排背景；直接输出最终光栅图片，不要生成编辑框、平台 UI 或水印。`
        ].join('\n')
      })
      x += size.w + 80
    })
  }

  return jobs
}

function truncateForCanvas(text: string, maxLength = 560) {
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength - 1)}...`
}

function actionPlanForSkillRun(run: CanvasSkillRun, skill: CanvasSkillManifest, jobs: CanvasGenerationJob[]) {
  if (!jobs.length) return []
  const minX = Math.min(...jobs.map((job) => job.placement.x))
  const minY = Math.min(...jobs.map((job) => job.placement.y))
  const maxX = Math.max(...jobs.map((job) => job.placement.x + job.placement.w))
  const titleWidth = Math.max(420, Math.min(1200, maxX - minX))
  const actions: CanvasAction[] = [
    {
      id: `${run.runId}_skill_summary`,
      type: 'place_note',
      payload: {
        shapeId: makeShapeId('skill_summary'),
        x: minX,
        y: minY - 132,
        w: titleWidth,
        h: 104,
        skillRunId: run.runId,
        text: [
          `${skill.name} Skill 任务`,
          `已创建 1 个 Skill Run，包含 ${jobs.length} 个版本任务。`,
          '下一步：按这些提示词生成图片，再把结果回填到对应画板。'
        ].join('\n')
      }
    }
  ]

  jobs.forEach((job, index) => {
    const noteHeight = 220
    actions.push(
      {
        id: `${job.jobId}_artboard`,
        type: 'create_artboard',
        payload: {
          shapeId: makeShapeId('skill_artboard'),
          x: job.placement.x,
          y: job.placement.y,
          w: job.placement.w,
          h: job.placement.h,
          title: `${index + 1}. ${job.title} (${job.aspectRatio})`,
          aspectRatio: job.aspectRatio,
          skillRunId: run.runId
        }
      },
      {
        id: `${job.jobId}_note`,
        type: 'place_note',
        payload: {
          shapeId: makeShapeId('skill_note'),
          x: job.placement.x,
          y: job.placement.y + job.placement.h + 20,
          w: Math.max(360, Math.min(job.placement.w, 640)),
          h: noteHeight,
          skillRunId: run.runId,
          text: [
            `${index + 1}. ${job.title}`,
            job.note ? `策略：${job.note}` : undefined,
            `比例：${job.aspectRatio}`,
            `输出文件：${job.outputName}`,
            '',
            '提示词：',
            truncateForCanvas(job.prompt)
          ]
            .filter(Boolean)
            .join('\n')
        }
      }
    )
  })

  actions.push({
    id: `${run.runId}_save_snapshot`,
    type: 'save_snapshot',
    payload: { skillRunId: run.runId }
  })
  return actions
}

async function prepareSkillRun(body: Record<string, unknown>) {
  const state = statePayload()
  const skillId = String(body.skillId ?? '')
  const skill = builtinSkills.find((item) => item.id === skillId)
  if (!skill) throw new Error(`Unknown skill: ${skillId}`)
  const context = buildCanvasContext(state)
  const missingReason = skillInputMissingReason(context, skill)
  const missingInputs = missingReason ? [missingReason] : []
  const runId = slugId('skillrun')
  const createdAt = nowIso()
  const run: CanvasSkillRun = {
    runId,
    skillId,
    status: missingInputs.length || skill.disabled ? 'needs_clarification' : 'planning',
    canvasId: state.canvasId,
    input: {
      userRequest: body.userRequest ? String(body.userRequest) : undefined,
      defaults: skill.defaults
    },
    context,
    createdAt,
    updatedAt: createdAt
  }
  await writeSkillRun(run)
  return {
    runId,
    skillId,
    readyToRun: run.status === 'planning',
    summary:
      run.status === 'planning'
        ? `将使用当前选中的图片运行「${skill.name}」。`
        : skill.disabledReason ?? '当前输入不足，无法运行 Skill。',
    defaults: skill.defaults,
    missingInputs: skill.disabledReason ? [skill.disabledReason] : missingInputs
  }
}

async function runSkillRun(runId: string) {
  const run = await readSkillRun(runId)
  if (!run) throw new Error(`Skill run not found: ${runId}`)
  const skill = builtinSkills.find((item) => item.id === run.skillId)
  if (!skill) throw new Error(`Unknown skill: ${run.skillId}`)
  if (skill.disabled) {
    return writeSkillRun({
      ...run,
      status: 'needs_clarification',
      error: skill.disabledReason
    })
  }
  const generationJobs = generationJobsForSkill(run, skill)
  const actions = actionPlanForSkillRun(run, skill, generationJobs)
  const nextRun: CanvasSkillRun = {
    ...run,
    status: generationJobs.length ? 'requires_external_generation' : 'needs_clarification',
    generationJobs,
    actions,
    outputs: {
      message: generationJobs.length
        ? 'Skill 已创建 1 个运行计划，并在画布上准备版本任务卡。下一步请按 generationJobs 生成图片，再用 apply_canvas_actions 或 import_image_asset 落回画布。'
        : '当前没有可用图片输入。'
    }
  }
  return writeSkillRun(nextRun)
}

function briefString(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  return trimmed || fallback
}

function normalizeXiaohongshuBrief(body: Record<string, unknown>): XiaohongshuCoverBrief {
  const rawBrief = isRecord(body.brief) ? body.brief : {}
  const extra = typeof body.userRequest === 'string' ? body.userRequest.trim() : ''
  return {
    contentType: briefString(rawBrief.contentType, '人像氛围'),
    title: briefString(rawBrief.title, '高级感封面'),
    titleStyle: briefString(rawBrief.titleStyle, '高级克制'),
    textPlacement: briefString(rawBrief.textPlacement, '顶部安全区'),
    focus: briefString(rawBrief.focus, '主体清晰、质感干净'),
    extra: extra || undefined
  }
}

function normalizeYoutubeBrief(body: Record<string, unknown>): YoutubeThumbnailBrief {
  const rawBrief = isRecord(body.brief) ? body.brief : {}
  const extra = typeof body.userRequest === 'string' ? body.userRequest.trim() : ''
  return {
    videoTopic: briefString(rawBrief.videoTopic, '视频核心主题'),
    title: briefString(rawBrief.title, '一定要看'),
    audience: briefString(rawBrief.audience, '目标观众'),
    thumbnailStyle: briefString(rawBrief.thumbnailStyle, '高对比强主体'),
    textPlacement: briefString(rawBrief.textPlacement, '左侧标题区'),
    focus: briefString(rawBrief.focus, '人物脸部、主体轮廓和关键情绪'),
    extra: extra || undefined
  }
}

const CROSS_PLATFORM_SPECS: CrossPlatformSpec[] = [
  {
    id: 'xiaohongshu-cover',
    name: '小红书 3:4',
    aspectRatio: '3:4',
    note: '竖版首图/封面，适合发现页瀑布流预览。',
    longSide: 640,
    standard: '小红书图文常用竖版 3:4，也可兼容 1:1 和 4:3；首图决定整篇笔记的视觉比例，竖版更适合移动端占屏。',
    safeArea: '标题、人物脸部、产品和关键卖点应远离四周边缘，顶部/底部至少保留 8% 安全边距，避免缩略图和裁切损坏。',
    guidance: [
      '优先保留主体身份、脸部/产品和原图风格，必要时向上下扩图补背景。',
      '如果需要文字，只放短标题或少量辅助文字，并做成完整封面设计，不要生成可编辑文字框。',
      '画面要适合小尺寸瀑布流快速识别，避免过密信息和廉价促销感。'
    ]
  },
  {
    id: 'instagram-feed',
    name: 'Instagram Feed 4:5',
    aspectRatio: '4:5',
    note: '移动端信息流竖版，适合获取更大屏幕占比。',
    longSide: 640,
    standard: 'Instagram feed 支持方图、横图和竖图；移动端品牌内容常用 4:5 竖图，让画面在信息流中占据更高空间。',
    safeArea: '把人物脸部、产品、Logo 和标题控制在画面中央安全区，四周至少留 8% 边距，避免网格预览或裁切影响重点。',
    guidance: [
      '重构为干净的移动信息流构图，主体比原图更明确。',
      '背景可以扩展或简化，但不要改变主体身份、产品形态和品牌色调。',
      '除非用户明确要求新增文案，否则不要添加平台 UI、标签、按钮或水印。'
    ]
  },
  {
    id: 'instagram-story',
    name: 'Instagram Story/Reels 9:16',
    aspectRatio: '9:16',
    note: '全屏竖版，适合 Story/Reels 预览和竖屏广告。',
    longSide: 800,
    standard: 'Instagram Stories/Reels 常用 9:16 全屏竖版；平台 UI 会占用顶部和底部区域。',
    safeArea: '顶部约 14%、底部约 20% 不放关键文字、Logo、脸部、产品或 CTA，中间区域承担主视觉。',
    guidance: [
      '把主体放在中间安全区，必要时进行上下扩图，而不是拉伸原图。',
      '顶部和底部保持干净背景或低信息区域，便于平台控件覆盖。',
      '如果要加文字，放在中部偏上/偏下安全区，短句大字，不要贴边。'
    ]
  },
  {
    id: 'wechat-official-account',
    name: '公众号',
    aspectRatio: '2.35:1',
    note: '公众号文章首图横幅，适合文章列表和分享预览。',
    longSide: 760,
    standard: '公众号文章首图通常需要横向封面感，移动端列表和分享卡片会压缩预览；标题、主体和品牌识别要在小尺寸下仍可读。',
    safeArea: '主体和标题放在中间安全区，左右边缘避免关键信息；标题不要贴顶贴底，四周至少保留 8% 安全边距。',
    guidance: [
      '重构为公众号文章首图，主体清楚、标题区域稳定，适合知识、品牌或活动内容。',
      '如果用户要求标题，必须把标题做成封面设计的一部分，文字完整、克制、可读。',
      '避免廉价营销模板、过多小字、主体太小或标题被裁切。'
    ]
  },
  {
    id: 'twitter-article-cover',
    name: '推特文章封面 5:2',
    aspectRatio: '5:2',
    note: '推特文章封面横幅，适合链接卡片、长文或话题预览。',
    longSide: 760,
    standard: '推特/X 文章或链接封面更适合宽横幅视觉；5:2 画面需要更强横向构图、明确视觉焦点和留白标题区。',
    safeArea: '人物、产品、标题和 Logo 保持在中间 80% 区域，左右边缘不要放关键信息，避免卡片预览裁切。',
    guidance: [
      '重构为宽横幅封面，适合文章链接卡片和社交传播预览。',
      '主体要明确但不要塞满全画面，留出可读标题区或呼吸空间。',
      '如需文字，使用短标题或话题级信息，不要堆砌说明、按钮或平台 UI。'
    ]
  },
  {
    id: 'linkedin-square',
    name: 'LinkedIn 方图 1:1',
    aspectRatio: '1:1',
    note: 'LinkedIn 方图，桌面和移动端都较稳。',
    longSide: 640,
    standard: 'LinkedIn 方图 1:1 常用于单图广告和动态内容，常见尺寸 1200x1200，适合跨端稳定展示。',
    safeArea: '主体、品牌符号和标题集中在中心 80% 区域，避免小字、二维码或细节靠近边缘。',
    guidance: [
      '做成简洁、稳定、专业的方图构图，主体一眼可见。',
      '适合把原图变成品牌观点、专业提示或产品价值展示。',
      '文字保持短而清晰，不能生成可编辑输入框或画布 UI。'
    ]
  }
]

const DEFAULT_CROSS_PLATFORM_IDS = [
  'xiaohongshu-cover',
  'instagram-feed',
  'instagram-story',
  'wechat-official-account',
  'twitter-article-cover'
]

function normalizeCrossPlatformBrief(body: Record<string, unknown>): CrossPlatformAdaptBrief {
  const rawBrief = isRecord(body.brief) ? body.brief : {}
  const extra = typeof body.userRequest === 'string' ? body.userRequest.trim() : ''
  const requestedPlatforms = Array.isArray(rawBrief.platforms)
    ? rawBrief.platforms.map((item) => String(item))
    : []
  const validIds = new Set(CROSS_PLATFORM_SPECS.map((spec) => spec.id))
  const platforms = requestedPlatforms.filter((id) => validIds.has(id))
  return {
    campaignGoal: briefString(rawBrief.campaignGoal, ''),
    platforms: platforms.length ? platforms : DEFAULT_CROSS_PLATFORM_IDS,
    contentKind: briefString(rawBrief.contentKind, '通用视觉'),
    preserve: briefString(rawBrief.preserve, ''),
    backgroundStrategy: briefString(rawBrief.backgroundStrategy, '智能扩图并补干净背景'),
    textPolicy: briefString(rawBrief.textPolicy, '不新增文字，只保留原图已有文字或按平台裁切重构'),
    extra: extra || undefined
  }
}

function crossPlatformBriefGaps(brief: CrossPlatformAdaptBrief) {
  const missingInputs: string[] = []
  const clarificationQuestions: string[] = []
  if (!brief.campaignGoal) {
    missingInputs.push('发布目标')
    clarificationQuestions.push('这些适配图主要用于什么发布目标？例如新品预热、教程分发、广告投放或品牌同步发布。')
  }
  if (!brief.preserve) {
    missingInputs.push('必须保留')
    clarificationQuestions.push('适配时哪些内容一定不能被裁掉或改变？例如人物脸部、产品轮廓、Logo、文字标题或原有色调。')
  }
  return {
    missingInputs,
    clarificationQuestions: clarificationQuestions.slice(0, 3)
  }
}

function pendingCrossPlatformBriefJob(input: {
  requestId: string
  outputDir: string
  baseX: number
  baseY: number
  brief: CrossPlatformAdaptBrief
  missingInputs: string[]
  clarificationQuestions: string[]
}) {
  const size = sizeForAspectRatio('4:5', 420)
  return {
    jobId: `${input.requestId}_brief_pending`,
    aspectRatio: '4:5',
    outputDir: input.outputDir,
    outputName: `${input.requestId}_cross_platform_brief_pending.png`,
    title: '一键跨平台适配简报待补充',
    placement: {
      x: input.baseX,
      y: input.baseY,
      ...size
    },
    note: `缺少：${input.missingInputs.join('、')}`,
    brief: input.brief,
    prompt: [
      '这是一键跨平台适配 Skill 的待补充简报，不要生成图片。',
      `缺少信息：${input.missingInputs.join('、')}`,
      `请先向用户提问：${input.clarificationQuestions.join(' / ')}`
    ].join('\n')
  } satisfies CanvasGenerationJob
}

const PRODUCT_MARKETING_PLATFORMS: Record<ProductMarketingPlatformId, ProductMarketingPlatformSpec> = {
  amazon_listing: {
    id: 'amazon_listing',
    name: 'Amazon 商品页 / A+',
    standards: [
      '主图必须优先合规：干净白底、产品完整清晰、不要叠加标题/Logo/促销角标/价格/评分/水印。',
      '附图可以讲卖点、细节、尺寸、使用场景，但避免“best-selling/top-rated”、保修、价格、二维码、联系方式、竞品比较等敏感内容。',
      'A+ 内容适合图文结合、规格说明、比较表、品牌故事和常见问题，但画面要避免低清晰度和夸大宣传。'
    ],
    recipes: [
      {
        id: 'main-image',
        title: 'Amazon 主图',
        aspectRatio: '1:1',
        longSide: 640,
        note: '白底合规主图，无叠字无道具，产品完整清晰。',
        guidance: [
          '生成白底商品主图，产品占画面主体，边缘留出少量安全空间。',
          '不要放文字、Logo、价格、徽章、评分、手绘箭头、装饰贴纸或额外道具。',
          '产品形状、材质、颜色必须清楚，不能裁掉关键轮廓。'
        ]
      },
      {
        id: 'lifestyle-use',
        title: '使用场景图',
        aspectRatio: '1:1',
        longSide: 640,
        note: '展示产品在真实生活/工作场景中的使用方式。',
        guidance: [
          '生成真实生活方式场景，让目标用户能立刻理解使用场合。',
          '产品仍是视觉中心，背景服务于场景，不要喧宾夺主。',
          '可以有人物或手部使用，但不要改变产品核心外观。'
        ]
      },
      {
        id: 'feature-callouts',
        title: '核心卖点图',
        aspectRatio: '1:1',
        longSide: 640,
        note: '用少量嵌入式文案解释 2-3 个卖点。',
        guidance: [
          '围绕用户提供的核心卖点做信息图式设计，可加入简短中文卖点文字。',
          '文字必须像成品海报设计一样嵌入图片，不要生成可编辑输入框或 UI 控件。',
          '避免价格、折扣、保修承诺、夸张排名和竞品比较。'
        ]
      },
      {
        id: 'detail-closeup',
        title: '细节 / 材质图',
        aspectRatio: '1:1',
        longSide: 640,
        note: '突出结构、材质、工艺或关键功能细节。',
        guidance: [
          '生成局部细节或微距感构图，强调材质、结构、接口、纹理或工艺。',
          '可以用简短标注解释细节，但文字数量要少且清晰。',
          '不要让细节图看起来像不真实的拼贴。'
        ]
      },
      {
        id: 'scale-benefit',
        title: '尺寸 / 对比 / 信任图',
        aspectRatio: '1:1',
        longSide: 640,
        note: '帮助用户理解大小、使用收益或购买理由。',
        guidance: [
          '用真实参照物、使用前后场景或简洁对比帮助用户理解产品价值。',
          '不要和竞品做直接对比，不要使用未经证实的绝对化营销词。',
          '画面信息层级清楚，优先解决购买疑问。'
        ]
      },
      {
        id: 'a-plus-module',
        title: 'A+ 横幅模块',
        aspectRatio: '16:9',
        longSide: 720,
        note: '适合 A+ 内容的品牌/功能横幅。',
        guidance: [
          '生成横向 A+ 内容模块，图片与少量说明文字平衡。',
          '突出品牌质感、核心功能和使用价值，适合商品详情页向下浏览。',
          '避免价格、促销、二维码、联系方式和夸张承诺。'
        ]
      }
    ]
  },
  shopify_store: {
    id: 'shopify_store',
    name: 'Shopify / 独立站商品页',
    standards: [
      '商品图组要保持一致的光线、机位、裁切和背景风格，便于在商品页和集合页浏览。',
      '主图应让产品成为焦点，附图补充角度、材质、细节、使用方式和品牌氛围。',
      '文字可以用于卖点模块，但不要压住产品，不要让整组图像风格跳跃。'
    ],
    recipes: [
      {
        id: 'gallery-hero',
        title: '独立站主视觉',
        aspectRatio: '1:1',
        longSide: 640,
        note: '干净商品主视觉，适合商品页首图。',
        guidance: [
          '生成干净、可信、适合商品页首图的产品英雄图。',
          '光线柔和稳定，背景去除干扰，产品轮廓完整。',
          '保留品牌质感，不要做廉价促销海报。'
        ]
      },
      {
        id: 'angle-detail',
        title: '角度 / 细节图',
        aspectRatio: '1:1',
        longSide: 640,
        note: '补充不同角度、材质和关键结构。',
        guidance: [
          '生成同一视觉体系下的角度或细节图。',
          '强调材质、接口、纹理、结构或包装细节。',
          '保持与主图一致的光线、色调和裁切。'
        ]
      },
      {
        id: 'lifestyle-scene',
        title: '生活方式图',
        aspectRatio: '4:5',
        longSide: 700,
        note: '展示目标用户真实使用场景。',
        guidance: [
          '生成适合目标用户的生活方式使用场景。',
          '让产品融入真实环境，同时保持主体明确。',
          '避免过度摆拍和杂乱背景。'
        ]
      },
      {
        id: 'benefit-banner',
        title: '卖点横幅',
        aspectRatio: '16:9',
        longSide: 720,
        note: '适合商品页模块的图文卖点横幅。',
        guidance: [
          '生成独立站商品页卖点模块，可加入 1-2 行清晰中文卖点。',
          '文字与产品形成专业网页模块效果，不要生成按钮或可点击 UI。',
          '留出足够呼吸感，适合网页向下滚动阅读。'
        ]
      },
      {
        id: 'use-case-grid',
        title: '使用方式 / 搭配图',
        aspectRatio: '1:1',
        longSide: 640,
        note: '补充使用方式、套装搭配或包装展示。',
        guidance: [
          '生成使用方式、搭配组合或包装展示图。',
          '强调购买后能得到什么、如何使用、适合什么场景。',
          '整组风格要与前面图片保持一致。'
        ]
      }
    ]
  },
  meta_ads: {
    id: 'meta_ads',
    name: 'Meta 广告',
    standards: [
      '信息流单图优先使用 4:5，方图 1:1 适合更广泛版位，Story/Reels 使用 9:16。',
      '广告图要快速传达产品和利益点，可露出品牌，但文字要少、可读，并避开边缘安全区。',
      '优先展示真实人物/场景中的产品使用，减少纯拼贴和低质促销模板感。'
    ],
    recipes: [
      {
        id: 'feed-4x5',
        title: 'Meta 信息流 4:5',
        aspectRatio: '4:5',
        longSide: 700,
        note: '移动信息流主广告图，主体和利益点一眼可见。',
        guidance: [
          '生成 4:5 移动信息流广告图，产品/人物主体清楚。',
          '可以加入极少量利益点文字，但必须完整、可读、远离边缘。',
          '画面要像真实品牌广告，不要像粗糙促销模板。'
        ]
      },
      {
        id: 'square-1x1',
        title: 'Meta 方图 1:1',
        aspectRatio: '1:1',
        longSide: 640,
        note: '适配方图版位和再营销素材。',
        guidance: [
          '生成 1:1 方图广告素材，产品焦点明确。',
          '构图简洁，适合在小尺寸预览中快速识别。',
          '文字少于画面主要信息，不要堆满卖点。'
        ]
      },
      {
        id: 'story-9x16',
        title: 'Story / Reels 9:16',
        aspectRatio: '9:16',
        longSide: 800,
        note: '全屏竖版广告图，避开顶部/底部 UI 区。',
        guidance: [
          '生成 9:16 全屏竖版广告，顶部和底部保留安全空间。',
          '主体垂直居中或略偏上，避免被平台 UI 遮挡。',
          '可以用简短利益点，但不要放在最顶端或最底端。'
        ]
      },
      {
        id: 'ugc-lifestyle',
        title: 'UGC 生活化图',
        aspectRatio: '4:5',
        longSide: 700,
        note: '更真实的生活方式广告方向。',
        guidance: [
          '生成真实生活化使用画面，降低硬广感。',
          '让目标用户感到“这个产品适合我”，不是只展示商品。',
          '画面仍需清楚呈现产品外观和核心使用收益。'
        ]
      }
    ]
  },
  google_display: {
    id: 'google_display',
    name: 'Google 展示广告',
    standards: [
      '常用响应式展示广告图片比例包括 1.91:1、1:1 和 9:16，对应推荐尺寸 1200x628、1200x1200、900x1600。',
      '避免在图片上叠加文字、Logo 和按钮；产品或服务应成为焦点，不要做拼贴和误导性按钮。',
      '图片要高清、自然、不歪斜、不过滤，留白不能压过主体。'
    ],
    recipes: [
      {
        id: 'landscape-191',
        title: 'Google 横图 1.91:1',
        aspectRatio: '1.91:1',
        longSide: 760,
        note: '响应式展示广告横图，减少叠字，产品清楚。',
        guidance: [
          '生成 1.91:1 横向展示广告图片，产品或服务是画面焦点。',
          '不要叠加文字、Logo、按钮、边框或促销贴纸。',
          '背景自然可信，避免数字合成感和拼贴感。'
        ]
      },
      {
        id: 'square-1x1',
        title: 'Google 方图 1:1',
        aspectRatio: '1:1',
        longSide: 640,
        note: '响应式展示广告方图，适配更多版位。',
        guidance: [
          '生成 1:1 展示广告图片，主体清楚且不靠边。',
          '不要把广告文案压进图片；让图片承担视觉吸引，文案交给广告标题。',
          '保持高清、自然色彩和完整产品轮廓。'
        ]
      },
      {
        id: 'portrait-9x16',
        title: 'Google 竖图 9:16',
        aspectRatio: '9:16',
        longSide: 800,
        note: '响应式竖版素材，适合移动端展示。',
        guidance: [
          '生成 9:16 竖版展示广告素材，主体占比适中。',
          '不要叠加按钮或大量文字，避免边缘被裁切。',
          '保留自然摄影感，不使用廉价合成背景。'
        ]
      }
    ]
  },
  general_ecommerce: {
    id: 'general_ecommerce',
    name: '通用电商套图',
    standards: [
      '套图要覆盖主图、使用场景、核心卖点、细节材质和信任/对比信息。',
      '文字只在卖点图中少量使用，并直接融入成品图片；主图和场景图优先保持干净。',
      '整组图保持统一色调、光线、品牌语气和产品外观，避免每张都像不同品牌。'
    ],
    recipes: [
      {
        id: 'clean-hero',
        title: '产品主图',
        aspectRatio: '1:1',
        longSide: 640,
        note: '干净可信的产品主视觉。',
        guidance: [
          '生成干净产品主视觉，产品轮廓完整、材质清晰。',
          '背景低干扰，适合电商首图或商品卡片。',
          '不要叠加大段文字和促销元素。'
        ]
      },
      {
        id: 'lifestyle',
        title: '生活方式图',
        aspectRatio: '4:5',
        longSide: 700,
        note: '展示产品在真实目标人群生活中的使用方式。',
        guidance: [
          '生成目标用户真实会使用的生活方式场景。',
          '产品与环境关系自然，突出使用价值。',
          '避免假大空背景和无关装饰。'
        ]
      },
      {
        id: 'benefit',
        title: '核心卖点图',
        aspectRatio: '1:1',
        longSide: 640,
        note: '用清晰视觉层级表达 1-3 个核心卖点。',
        guidance: [
          '围绕核心卖点做成品信息图，可使用简短中文卖点文字。',
          '文字要像专业电商图设计，字体、配色、图标和排版直接融入图片。',
          '不要生成可编辑输入框、选中框或画布 UI。'
        ]
      },
      {
        id: 'detail',
        title: '细节材质图',
        aspectRatio: '1:1',
        longSide: 640,
        note: '强化质感、材料、结构和关键功能。',
        guidance: [
          '生成细节或局部特写，突出材质和工艺。',
          '必要时加少量标注，但不要遮挡产品细节。',
          '画面应清晰可信，不要过度锐化或塑料感。'
        ]
      },
      {
        id: 'trust',
        title: '信任 / 购买理由图',
        aspectRatio: '16:9',
        longSide: 720,
        note: '总结购买理由、适用人群或场景价值。',
        guidance: [
          '生成横向总结图，表达适用人群、核心购买理由或场景收益。',
          '可以加入简短中文标题和 2-3 个利益点，但避免夸张承诺。',
          '整体像品牌商品页模块，而不是低价促销图。'
        ]
      }
    ]
  }
}

function normalizeProductMarketingBrief(body: Record<string, unknown>): ProductMarketingBrief {
  const rawBrief = isRecord(body.brief) ? body.brief : {}
  const extra = typeof body.userRequest === 'string' ? body.userRequest.trim() : ''
  const platform = String(rawBrief.platform ?? 'general_ecommerce') as ProductMarketingPlatformId
  const imageCountValue = String(rawBrief.imageCount ?? 'platform_default')
  const imageCountNumber = Number(imageCountValue)
  return {
    platform: platform in PRODUCT_MARKETING_PLATFORMS ? platform : 'general_ecommerce',
    productName: briefString(rawBrief.productName, ''),
    targetAudience: briefString(rawBrief.targetAudience, ''),
    sellingPoints: briefString(rawBrief.sellingPoints, ''),
    brandTone: briefString(rawBrief.brandTone, '干净专业'),
    imageCount:
      Number.isInteger(imageCountNumber) && imageCountNumber >= 1
        ? Math.min(6, Math.max(1, imageCountNumber))
        : 'platform_default',
    extra: extra || undefined
  }
}

function productMarketingBriefGaps(brief: ProductMarketingBrief) {
  const missingInputs: string[] = []
  const clarificationQuestions: string[] = []
  if (!brief.productName) {
    missingInputs.push('产品名称/品类')
    clarificationQuestions.push('这个产品的准确名称或品类是什么？')
  }
  if (!brief.targetAudience) {
    missingInputs.push('目标用户')
    clarificationQuestions.push('主要卖给谁？请给一个具体人群或使用场景。')
  }
  if (!brief.sellingPoints) {
    missingInputs.push('核心卖点')
    clarificationQuestions.push('最想让用户记住哪 1-3 个卖点？')
  }
  return {
    missingInputs,
    clarificationQuestions: clarificationQuestions.slice(0, 3)
  }
}

function productMarketingPrompt(input: {
  context: CanvasContext
  skill: CanvasSkillManifest
  userRequest?: string
  brief: ProductMarketingBrief
  platform: ProductMarketingPlatformSpec
  spec: ProductMarketingOutputSpec
  index: number
  total: number
}) {
  return [
    skillPromptBase(input.skill, input.context, input.userRequest),
    `请基于参考图片生成「${input.platform.name}」产品营销套图中的第 ${input.index + 1}/${input.total} 张成品图：${input.spec.title}。`,
    `平台/场景：${input.platform.name}。比例：${input.spec.aspectRatio}。`,
    `产品：${input.brief.productName}。目标用户：${input.brief.targetAudience}。`,
    `核心卖点：${input.brief.sellingPoints}。视觉语气：${input.brief.brandTone}。`,
    input.brief.extra ? `补充要求：${input.brief.extra}。` : undefined,
    `平台标准：${input.platform.standards.join(' ')}`,
    `本张图片目标：${input.spec.note}`,
    `本张执行要求：${input.spec.guidance.join(' ')}`,
    `套图一致性：保持产品外观、品牌气质、光线、色调和材质表达一致；不同图片承担不同销售任务，不要每张重复同一种构图。`,
    `成品要求：直接输出最终可用的光栅图片，若需要标题/卖点文字，必须作为图片设计的一部分生成在画面里；不要生成可编辑输入框、选中框、画布 UI、占位框或单独文字层。`,
    `质量要求：高清、主体完整、产品不变形、文字完整可读、边缘留安全空间、不要水印、不要乱码文字、不要不实夸张承诺。`
  ]
    .filter(Boolean)
    .join('\n')
}

function productMarketingJobs(input: {
  requestId: string
  context: CanvasContext
  skill: CanvasSkillManifest
  userRequest?: string
  brief: ProductMarketingBrief
  outputDir: string
  baseX: number
  baseY: number
}) {
  const platform = PRODUCT_MARKETING_PLATFORMS[input.brief.platform]
  const count =
    input.brief.imageCount === 'platform_default'
      ? platform.recipes.length
      : Math.min(input.brief.imageCount, platform.recipes.length)
  let x = input.baseX
  return platform.recipes.slice(0, count).map((spec, index) => {
    const size = sizeForAspectRatio(spec.aspectRatio, spec.longSide)
    const job: CanvasGenerationJob = {
      jobId: `${input.requestId}_job_${index + 1}`,
      aspectRatio: spec.aspectRatio,
      outputDir: input.outputDir,
      outputName: `${input.requestId}_${spec.id}.png`,
      title: spec.title,
      placement: {
        x,
        y: input.baseY,
        ...size
      },
      note: `${platform.name}：${spec.note}`,
      brief: input.brief,
      prompt: productMarketingPrompt({
        context: input.context,
        skill: input.skill,
        userRequest: input.userRequest,
        brief: input.brief,
        platform,
        spec,
        index,
        total: count
      })
    }
    x += size.w + 80
    return job
  })
}

function pendingProductBriefJob(input: {
  requestId: string
  outputDir: string
  baseX: number
  baseY: number
  brief: ProductMarketingBrief
  missingInputs: string[]
  clarificationQuestions: string[]
}) {
  const size = sizeForAspectRatio('1:1', 420)
  return {
    jobId: `${input.requestId}_brief_pending`,
    aspectRatio: '1:1',
    outputDir: input.outputDir,
    outputName: `${input.requestId}_brief_pending.png`,
    title: '产品营销组图简报待补充',
    placement: {
      x: input.baseX,
      y: input.baseY,
      ...size
    },
    note: `缺少：${input.missingInputs.join('、')}`,
    brief: input.brief,
    prompt: [
      '这是产品营销组图的待补充简报，不要生成图片。',
      `缺少信息：${input.missingInputs.join('、')}`,
      `请先向用户提问：${input.clarificationQuestions.join(' / ')}`
    ].join('\n')
  } satisfies CanvasGenerationJob
}

const LOGO_BRAND_STANDARDS = [
  '品牌指南要把 Logo、字体、颜色、影像、语气和使用规则统一起来，确保不同触点保持一致。',
  '品牌简报应先明确目标受众、定位、品牌人格、视觉与语言表达，再进入 Logo 和视觉系统设计。',
  '品牌名称和 Logo 应尽量具有独特性，避免过于通用、仅描述品类，避免模仿现有知名品牌或行业常见符号。',
  '品牌应用图中的正文和说明文字要有足够明暗对比；Logo 本身可更自由，但应用场景必须保证可读性。'
]

const LOGO_BRAND_OUTPUTS: LogoBrandOutputSpec[] = [
  {
    id: 'primary-logo',
    title: '主 Logo 概念',
    aspectRatio: '1:1',
    longSide: 640,
    note: '品牌主标志方向，包含图形符号和品牌名组合。',
    guidance: [
      '生成一个干净、可识别、可扩展的主 Logo 概念，包含 symbol + wordmark 组合。',
      '品牌名应尽量准确呈现，文字结构完整，不要出现乱码、错字或额外无关字母。',
      '图形符号要与品牌定位和行业相关，但不要直接使用行业里最泛滥的通用图标。'
    ]
  },
  {
    id: 'alternate-logo',
    title: '备选 Logo 方向',
    aspectRatio: '1:1',
    longSide: 640,
    note: '同一品牌策略下的另一种视觉方向，便于比较。',
    guidance: [
      '生成与主 Logo 不同但仍符合品牌定位的备选方向。',
      '可以改变符号隐喻、字形气质或构图方式，但保持品牌名、行业和目标受众一致。',
      '不要做成同一个图标的简单换色版本。'
    ]
  },
  {
    id: 'brand-board',
    title: '品牌视觉板',
    aspectRatio: '16:9',
    longSide: 760,
    note: '展示 Logo、色板、字体气质、图形语言和影像氛围。',
    guidance: [
      '生成一张品牌视觉板，包含 Logo 展示、核心色板、辅助色、字体气质、图形纹理或影像风格。',
      '版面要像专业品牌指南页面，信息层级清晰，颜色和字体选择与品牌人格一致。',
      '色板和文字说明要可读，避免低对比度小字。'
    ]
  },
  {
    id: 'social-icon',
    title: '社媒头像 / App 图标',
    aspectRatio: '1:1',
    longSide: 640,
    note: '把品牌符号简化为小尺寸也能识别的图标。',
    guidance: [
      '生成适合社媒头像或 app 图标的简化品牌符号。',
      '小尺寸仍能识别，轮廓清楚，色彩对比明确。',
      '不要塞入复杂小字；如果品牌名太长，优先使用首字母或抽象符号。'
    ]
  },
  {
    id: 'application-preview',
    title: '品牌应用预览',
    aspectRatio: '16:9',
    longSide: 760,
    note: '展示 Logo 在官网、名片、包装或社媒素材中的真实应用。',
    guidance: [
      '生成品牌应用 mockup，例如官网首屏、名片、包装、社媒封面或产品界面。',
      '应用预览要体现 Logo、颜色、字体和视觉元素的一致性。',
      '不要生成可点击按钮框、编辑框或画布 UI；所有内容直接成为图片设计的一部分。'
    ]
  }
]

function normalizeLogoBrandBrief(body: Record<string, unknown>): LogoBrandBrief {
  const rawBrief = isRecord(body.brief) ? body.brief : {}
  const extra = typeof body.userRequest === 'string' ? body.userRequest.trim() : ''
  const outputCountValue = String(rawBrief.outputCount ?? 'platform_default')
  const outputCountNumber = Number(outputCountValue)
  return {
    brandName: briefString(rawBrief.brandName, ''),
    industry: briefString(rawBrief.industry, ''),
    targetAudience: briefString(rawBrief.targetAudience, ''),
    positioning: briefString(rawBrief.positioning, ''),
    personality: briefString(rawBrief.personality, '可信、清晰、有记忆点'),
    logoStyle: briefString(rawBrief.logoStyle, '现代简洁'),
    usageContexts: briefString(rawBrief.usageContexts, '官网、社媒头像、名片、产品包装'),
    outputCount:
      Number.isInteger(outputCountNumber) && outputCountNumber >= 1
        ? Math.min(5, Math.max(1, outputCountNumber))
        : 'platform_default',
    extra: extra || undefined
  }
}

function logoBrandBriefGaps(brief: LogoBrandBrief) {
  const missingInputs: string[] = []
  const clarificationQuestions: string[] = []
  if (!brief.brandName) {
    missingInputs.push('品牌名')
    clarificationQuestions.push('品牌名是什么？如果还没定，也可以给 2-3 个候选名。')
  }
  if (!brief.industry) {
    missingInputs.push('行业/品类')
    clarificationQuestions.push('这个品牌属于什么行业或产品品类？')
  }
  if (!brief.targetAudience) {
    missingInputs.push('目标受众')
    clarificationQuestions.push('主要面向谁？请给一个具体人群或使用场景。')
  }
  if (!brief.positioning) {
    missingInputs.push('定位/差异点')
    clarificationQuestions.push('这个品牌最想被用户记住的差异点是什么？')
  }
  return {
    missingInputs,
    clarificationQuestions: clarificationQuestions.slice(0, 3)
  }
}

function logoBrandPrompt(input: {
  context: CanvasContext
  skill: CanvasSkillManifest
  userRequest?: string
  brief: LogoBrandBrief
  spec: LogoBrandOutputSpec
  index: number
  total: number
}) {
  return [
    skillPromptBase(input.skill, input.context, input.userRequest),
    `请生成「Logo 与品牌」系统中的第 ${input.index + 1}/${input.total} 张成品图：${input.spec.title}。`,
    `品牌名：${input.brief.brandName}。行业/品类：${input.brief.industry}。`,
    `目标受众：${input.brief.targetAudience}。定位/差异点：${input.brief.positioning}。`,
    `品牌人格：${input.brief.personality}。Logo 风格：${input.brief.logoStyle}。使用场景：${input.brief.usageContexts}。`,
    input.brief.extra ? `补充要求：${input.brief.extra}。` : undefined,
    `专业规则：${LOGO_BRAND_STANDARDS.join(' ')}`,
    `本张图片目标：${input.spec.note}`,
    `本张执行要求：${input.spec.guidance.join(' ')}`,
    `设计方向：形成可延展的品牌识别系统，兼顾记忆点、小尺寸识别、黑白/反白可用性、色彩一致性和实际应用场景。`,
    `重要限制：不要模仿 Apple、Nike、Google、Adobe、OpenAI 等知名品牌；不要使用现成商标、版权角色或过于通用的行业图标；不要声称已完成商标检索或法律注册。`,
    `成品要求：直接输出最终可用的光栅设计图，Logo、文字、色板、字体和 mockup 都必须成为图片设计的一部分；不要生成可编辑输入框、选中框、画布 UI、占位框或单独文字层。`,
    `质量要求：高清、留白合理、文字完整可读、品牌名尽量准确、色彩对比清楚、不要乱码、水印、拼贴感或低质模板感。`
  ]
    .filter(Boolean)
    .join('\n')
}

function logoBrandJobs(input: {
  requestId: string
  context: CanvasContext
  skill: CanvasSkillManifest
  userRequest?: string
  brief: LogoBrandBrief
  outputDir: string
  baseX: number
  baseY: number
}) {
  const count =
    input.brief.outputCount === 'platform_default'
      ? LOGO_BRAND_OUTPUTS.length
      : Math.min(input.brief.outputCount, LOGO_BRAND_OUTPUTS.length)
  let x = input.baseX
  return LOGO_BRAND_OUTPUTS.slice(0, count).map((spec, index) => {
    const size = sizeForAspectRatio(spec.aspectRatio, spec.longSide)
    const job: CanvasGenerationJob = {
      jobId: `${input.requestId}_job_${index + 1}`,
      aspectRatio: spec.aspectRatio,
      outputDir: input.outputDir,
      outputName: `${input.requestId}_${spec.id}.png`,
      title: spec.title,
      placement: {
        x,
        y: input.baseY,
        ...size
      },
      note: `品牌系统：${spec.note}`,
      brief: input.brief,
      prompt: logoBrandPrompt({
        context: input.context,
        skill: input.skill,
        userRequest: input.userRequest,
        brief: input.brief,
        spec,
        index,
        total: count
      })
    }
    x += size.w + 80
    return job
  })
}

function pendingLogoBrandBriefJob(input: {
  requestId: string
  outputDir: string
  baseX: number
  baseY: number
  brief: LogoBrandBrief
  missingInputs: string[]
  clarificationQuestions: string[]
}) {
  const size = sizeForAspectRatio('1:1', 420)
  return {
    jobId: `${input.requestId}_brief_pending`,
    aspectRatio: '1:1',
    outputDir: input.outputDir,
    outputName: `${input.requestId}_logo_brief_pending.png`,
    title: 'Logo 与品牌简报待补充',
    placement: {
      x: input.baseX,
      y: input.baseY,
      ...size
    },
    note: `缺少：${input.missingInputs.join('、')}`,
    brief: input.brief,
    prompt: [
      '这是 Logo 与品牌 Skill 的待补充简报，不要生成图片。',
      `缺少信息：${input.missingInputs.join('、')}`,
      `请先向用户提问：${input.clarificationQuestions.join(' / ')}`
    ].join('\n')
  } satisfies CanvasGenerationJob
}

const MARKETING_BROCHURE_FORMATS: Record<MarketingBrochureFormatId, string> = {
  trifold_brochure: '三折页宣传册',
  service_brochure: '服务介绍册',
  event_campaign: '活动推广册',
  product_brochure: '产品推广册'
}

const MARKETING_BROCHURE_STANDARDS = [
  '三折页通常有六个信息区域，适合用封面、问题/收益、方案、证明、细节和行动号召来组织内容。',
  '宣传册应在明确信息目标的基础上讲故事：封面吸引注意，内页解释价值，结尾给出清晰 CTA。',
  '专业营销物料需要保持品牌颜色、Logo、字体和图片风格一致，并控制文字密度。',
  '落地页和活动物料都应聚焦单一目标、明确受众、清楚承诺，并用直接 CTA 引导下一步。',
  '用于广告或社媒的推广图要短信息、高可读性、强视觉焦点，并避免夸张承诺、乱码文字和低质促销模板。'
]

const MARKETING_BROCHURE_OUTPUTS: MarketingBrochureOutputSpec[] = [
  {
    id: 'outer-panels',
    title: '三折页外页',
    aspectRatio: '4:3',
    longSide: 760,
    note: '封面、封底和折入口三面板，负责第一印象和 CTA。',
    guidance: [
      '生成横向展开的三折页外页，清楚分成 3 个竖向面板：封底、封面、折入口。',
      '封面要有强标题、主视觉和品牌识别；封底要有 CTA、联系方式/二维码占位感；折入口要给出一句诱因或核心利益。',
      '面板之间要有明确折线/栏距，文字完整在安全区内，不要把关键信息压到折线或边缘。'
    ]
  },
  {
    id: 'inner-panels',
    title: '三折页内页',
    aspectRatio: '4:3',
    longSide: 760,
    note: '三栏内页，解释价值、服务/产品内容和可信理由。',
    guidance: [
      '生成横向展开的三折页内页，清楚分成 3 个竖向内容面板。',
      '内容结构建议：用户痛点/机会、解决方案或流程、证明/案例/权益。',
      '信息层级要清晰，图文比例平衡，不要堆满小字；重点句、图标和图片要服务于阅读路径。'
    ]
  },
  {
    id: 'mockup-preview',
    title: '宣传册样机预览',
    aspectRatio: '16:9',
    longSide: 760,
    note: '展示宣传册折叠后的真实质感和品牌一致性。',
    guidance: [
      '生成宣传册立体样机或桌面展示预览，体现纸张质感、折页结构和主视觉。',
      '样机中的 Logo、颜色和标题应与外页/内页方向一致。',
      '不要做成空白样机；要能看出这是完整营销物料。'
    ]
  },
  {
    id: 'social-promo',
    title: '社媒推广图',
    aspectRatio: '4:5',
    longSide: 720,
    note: '把同一宣传主题改成移动端推广视觉。',
    guidance: [
      '生成 4:5 移动端社媒推广图，突出同一个活动/产品核心信息。',
      '标题短、CTA 明确、主体清晰，边缘保留安全空间。',
      '视觉风格与宣传册一致，但构图要适合信息流快速浏览。'
    ]
  }
]

function normalizeMarketingBrochureBrief(body: Record<string, unknown>): MarketingBrochureBrief {
  const rawBrief = isRecord(body.brief) ? body.brief : {}
  const extra = typeof body.userRequest === 'string' ? body.userRequest.trim() : ''
  const format = String(rawBrief.format ?? 'trifold_brochure') as MarketingBrochureFormatId
  const outputCountValue = String(rawBrief.outputCount ?? 'platform_default')
  const outputCountNumber = Number(outputCountValue)
  return {
    format: format in MARKETING_BROCHURE_FORMATS ? format : 'trifold_brochure',
    campaignName: briefString(rawBrief.campaignName, ''),
    brandName: briefString(rawBrief.brandName, ''),
    targetAudience: briefString(rawBrief.targetAudience, ''),
    keyMessage: briefString(rawBrief.keyMessage, ''),
    offer: briefString(rawBrief.offer, ''),
    callToAction: briefString(rawBrief.callToAction, ''),
    visualTone: briefString(rawBrief.visualTone, '清晰专业'),
    outputCount:
      Number.isInteger(outputCountNumber) && outputCountNumber >= 1
        ? Math.min(4, Math.max(1, outputCountNumber))
        : 'platform_default',
    extra: extra || undefined
  }
}

function marketingBrochureBriefGaps(brief: MarketingBrochureBrief) {
  const missingInputs: string[] = []
  const clarificationQuestions: string[] = []
  if (!brief.campaignName) {
    missingInputs.push('活动/产品')
    clarificationQuestions.push('这份宣传册要推广的活动、服务或产品是什么？')
  }
  if (!brief.targetAudience) {
    missingInputs.push('目标受众')
    clarificationQuestions.push('主要给谁看？请给一个具体人群和使用场景。')
  }
  if (!brief.keyMessage) {
    missingInputs.push('核心信息')
    clarificationQuestions.push('这份宣传册最想让用户记住的一句话是什么？')
  }
  if (!brief.callToAction) {
    missingInputs.push('行动号召')
    clarificationQuestions.push('用户看完后应该做什么？例如预约、报名、扫码、咨询或购买。')
  }
  return {
    missingInputs,
    clarificationQuestions: clarificationQuestions.slice(0, 3)
  }
}

function marketingBrochurePrompt(input: {
  context: CanvasContext
  skill: CanvasSkillManifest
  userRequest?: string
  brief: MarketingBrochureBrief
  spec: MarketingBrochureOutputSpec
  index: number
  total: number
}) {
  return [
    skillPromptBase(input.skill, input.context, input.userRequest),
    `请生成「营销宣传册」系统中的第 ${input.index + 1}/${input.total} 张成品图：${input.spec.title}。`,
    `物料类型：${MARKETING_BROCHURE_FORMATS[input.brief.format]}。活动/产品：${input.brief.campaignName}。`,
    input.brief.brandName ? `品牌名：${input.brief.brandName}。` : undefined,
    `目标受众：${input.brief.targetAudience}。核心信息：${input.brief.keyMessage}。`,
    input.brief.offer ? `优惠/内容点：${input.brief.offer}。` : undefined,
    `行动号召：${input.brief.callToAction}。视觉语气：${input.brief.visualTone}。`,
    input.brief.extra ? `补充要求：${input.brief.extra}。` : undefined,
    `专业规则：${MARKETING_BROCHURE_STANDARDS.join(' ')}`,
    `本张图片目标：${input.spec.note}`,
    `本张执行要求：${input.spec.guidance.join(' ')}`,
    `内容策略：标题要短而明确，信息从问题/收益到方案/证明再到 CTA；不要把所有文案塞进一张图，宁可清楚留白。`,
    `印刷/阅读要求：面板边缘和折线附近保留安全空间；文字、Logo、二维码占位、联系方式或 CTA 不要贴边；整体适合打印和数字预览。`,
    `成品要求：直接输出最终可用的光栅设计图，标题、文案、图标、CTA、色彩和版式必须直接生成在图片中；不要生成可编辑输入框、选中框、画布 UI、占位框或单独文字层。`,
    `质量要求：高清、品牌一致、层级清楚、文字完整可读、不要乱码、水印、夸张承诺、低质促销模板或信息过载。`
  ]
    .filter(Boolean)
    .join('\n')
}

function marketingBrochureJobs(input: {
  requestId: string
  context: CanvasContext
  skill: CanvasSkillManifest
  userRequest?: string
  brief: MarketingBrochureBrief
  outputDir: string
  baseX: number
  baseY: number
}) {
  const count =
    input.brief.outputCount === 'platform_default'
      ? MARKETING_BROCHURE_OUTPUTS.length
      : Math.min(input.brief.outputCount, MARKETING_BROCHURE_OUTPUTS.length)
  let x = input.baseX
  return MARKETING_BROCHURE_OUTPUTS.slice(0, count).map((spec, index) => {
    const size = sizeForAspectRatio(spec.aspectRatio, spec.longSide)
    const job: CanvasGenerationJob = {
      jobId: `${input.requestId}_job_${index + 1}`,
      aspectRatio: spec.aspectRatio,
      outputDir: input.outputDir,
      outputName: `${input.requestId}_${spec.id}.png`,
      title: spec.title,
      placement: {
        x,
        y: input.baseY,
        ...size
      },
      note: `营销宣传册：${spec.note}`,
      brief: input.brief,
      prompt: marketingBrochurePrompt({
        context: input.context,
        skill: input.skill,
        userRequest: input.userRequest,
        brief: input.brief,
        spec,
        index,
        total: count
      })
    }
    x += size.w + 80
    return job
  })
}

function pendingMarketingBrochureBriefJob(input: {
  requestId: string
  outputDir: string
  baseX: number
  baseY: number
  brief: MarketingBrochureBrief
  missingInputs: string[]
  clarificationQuestions: string[]
}) {
  const size = sizeForAspectRatio('4:3', 520)
  return {
    jobId: `${input.requestId}_brief_pending`,
    aspectRatio: '4:3',
    outputDir: input.outputDir,
    outputName: `${input.requestId}_marketing_brief_pending.png`,
    title: '营销宣传册简报待补充',
    placement: {
      x: input.baseX,
      y: input.baseY,
      ...size
    },
    note: `缺少：${input.missingInputs.join('、')}`,
    brief: input.brief,
    prompt: [
      '这是营销宣传册 Skill 的待补充简报，不要生成图片。',
      `缺少信息：${input.missingInputs.join('、')}`,
      `请先向用户提问：${input.clarificationQuestions.join(' / ')}`
    ].join('\n')
  } satisfies CanvasGenerationJob
}

function xiaohongshuPrompt(input: {
  context: CanvasContext
  skill: CanvasSkillManifest
  userRequest?: string
  brief: XiaohongshuCoverBrief
}) {
  return [
    skillPromptBase(input.skill, input.context, input.userRequest),
    `请基于参考图片生成 1 张小红书 3:4 成品封面图，不要输出半成品底图。`,
    `内容类型：${input.brief.contentType}。`,
    `主标题必须直接设计进图片里，文字内容为：「${input.brief.title}」。`,
    `标题风格：${input.brief.titleStyle}。标题位置：${input.brief.textPlacement}。`,
    `保留重点：${input.brief.focus}。`,
    input.brief.extra ? `补充要求：${input.brief.extra}。` : undefined,
    `成品要求：标题要有真实海报/封面设计感，包括字体选择、字重、描边、阴影、压字、留白、辅助小字或装饰线条，但整体要高级克制。`,
    `构图要求：标题必须完整留在画面内，四周至少保留 8% 安全边距；人物/产品主体不要被标题遮挡，头部、脸部和关键手势不要裁切。`,
    `视觉方向：高级、干净、主体清晰，适合小红书信息流点击，但避免廉价营销感。`,
    `文字要求：尽量准确呈现主标题「${input.brief.title}」，不要把标题放出画面边缘，不要生成输入框、选中框、编辑框或画布 UI。`,
    `避免：低清晰度、畸形主体、过度磨皮、过度堆叠装饰、错乱文字、水印、标题裁切、标题超出画布。`
  ]
    .filter(Boolean)
    .join('\n')
}

function youtubePrompt(input: {
  context: CanvasContext
  skill: CanvasSkillManifest
  userRequest?: string
  brief: YoutubeThumbnailBrief
}) {
  return [
    skillPromptBase(input.skill, input.context, input.userRequest),
    `请基于参考图片生成 1 张 YouTube 16:9 成品缩略图，不要输出半成品底图。`,
    `视频主题：${input.brief.videoTopic}。目标观众：${input.brief.audience}。`,
    `大标题必须直接设计进图片里，文字内容为：「${input.brief.title}」。`,
    `缩略图风格：${input.brief.thumbnailStyle}。标题位置：${input.brief.textPlacement}。`,
    `保留重点：${input.brief.focus}。`,
    input.brief.extra ? `补充要求：${input.brief.extra}。` : undefined,
    `规格参考：YouTube 官方建议缩略图尽量大，常用预览比例为 16:9；设计时请确保小尺寸仍有强主体和清晰点击理由。`,
    `成品要求：标题要像专业 YouTube 缩略图设计，具备强层级、大字可读性、高对比、适度描边/阴影/色块，但不要廉价模板感。`,
    `构图要求：标题必须完整留在画面内，四周至少保留 8% 安全边距；右下角避开时长标签区域，主体与背景保持高对比，避免信息被裁切。`,
    `文字要求：尽量准确呈现大标题「${input.brief.title}」，不要生成输入框、选中框、编辑框或画布 UI。`,
    `避免：低清晰度、主体变形、杂乱背景、错乱文字、水印、标题裁切、夸张廉价营销模板。`
  ]
    .filter(Boolean)
    .join('\n')
}

function crossPlatformPrompt(input: {
  context: CanvasContext
  skill: CanvasSkillManifest
  userRequest?: string
  brief: CrossPlatformAdaptBrief
  spec: CrossPlatformSpec
}) {
  return [
    skillPromptBase(input.skill, input.context, input.userRequest),
    `请将参考图片重构/扩图/裁切适配为「${input.spec.name}」平台成品视觉，比例 ${input.spec.aspectRatio}。`,
    `发布目标：${input.brief.campaignGoal}。`,
    `内容类型：${input.brief.contentKind}。`,
    `平台用途：${input.spec.note}`,
    `平台标准：${input.spec.standard}`,
    `安全区：${input.spec.safeArea}`,
    `必须保留：${input.brief.preserve}。`,
    `背景处理：${input.brief.backgroundStrategy}。`,
    `文字处理：${input.brief.textPolicy}。`,
    input.brief.extra ? `补充要求：${input.brief.extra}。` : undefined,
    `本平台执行要求：${input.spec.guidance.join(' ')}`,
    `执行方式：优先做智能扩图、裁切重构、背景补全和视觉重排；严禁简单拉伸原图或只把原图居中留白。`,
    `构图要求：主体完整，脸部/产品/关键动作不被平台裁切；画面要像针对该平台重新设计过的最终成品，而不是尺寸转换预览。`,
    `成品要求：直接输出最终可用的光栅图片；如果需要文字，文字必须作为图片设计的一部分生成在画面中，不要生成可编辑输入框、选中框、画布 UI、占位框或单独文字层。`,
    `重要限制：不要添加无关平台 UI、虚假按钮、二维码、水印或不存在的品牌标识；不要改变人物身份、产品形状或原图关键元素。`,
    `避免：比例拉伸、主体缺失、过度裁脸、低清晰度、背景断裂、错乱文字、边缘关键信息被平台 UI 遮挡。`
  ]
    .filter(Boolean)
    .join('\n')
}

async function materializeSkillInputImage(body: Record<string, unknown>, primary: ShapeSummary) {
  const existingPath = absoluteCanvasPath(primary.assetPath)
  if (existingPath) {
    return {
      inputImagePath: existingPath,
      inputAssetPath: primary.assetPath
    }
  }

  const dataUrl =
    typeof body.inputDataUrl === 'string'
      ? body.inputDataUrl
      : primary.assetUrl?.startsWith('data:')
        ? primary.assetUrl
        : undefined
  if (!dataUrl) {
    return {
      inputImagePath: undefined,
      inputAssetPath: undefined
    }
  }

  const parsed = parseDataUrl(dataUrl)
  const title = body.inputTitle ? String(body.inputTitle) : 'skill-input.png'
  const written = await writeImageBufferIntoCanvas({
    buffer: parsed.buffer,
    source: 'upload',
    originalName: title
  })
  return {
    inputImagePath: written.absolutePath,
    inputAssetPath: written.record.assetPath
  }
}

async function submitSkillRequest(body: Record<string, unknown>) {
  if (!session) throw new Error('Canvas session is not open')
  const skillId = String(body.skillId ?? '')
  const executableSkillIds = new Set([
    'xiaohongshu-cover',
    'youtube-thumbnail',
    'cross-platform-adapt',
    'product-marketing-set',
    'logo-and-brand',
    'marketing-brochure'
  ])
  if (!executableSkillIds.has(skillId)) {
    throw new Error('当前真实生成闭环启用「小红书封面」「YouTube 封面图」「一键跨平台适配」「产品营销组图」「Logo 与品牌」「营销宣传册」。其它 Skill 会在后续接入。')
  }
  const skill = builtinSkills.find((item) => item.id === skillId)
  if (!skill) throw new Error(`Unknown skill: ${skillId}`)
  if (skill.disabled) throw new Error(skill.disabledReason ?? `Skill is disabled: ${skillId}`)
  const state = statePayload()
  const context = buildCanvasContext(state)
  const primary = context.selection.primaryShape
  if (!primary && skill.inputRequirements.requiresSelection) throw new Error('请先选中一张图片。')

  const requestId = slugId('skill')
  const runId = slugId('skillrun')
  const userRequest = body.userRequest ? String(body.userRequest) : undefined
  const { inputImagePath, inputAssetPath } = primary
    ? await materializeSkillInputImage(body, primary)
    : { inputImagePath: undefined, inputAssetPath: undefined }
  const outputDir = path.join(session.storagePath, 'assets/images')
  const baseX = primary ? primary.bounds.x + primary.bounds.w + 80 : 120
  const baseY = primary ? primary.bounds.y : 100
  let brief: Record<string, unknown>
  let generationJobs: CanvasGenerationJob[]
  let briefStatus: CanvasSkillRequest['briefStatus'] = 'ready_to_generate'
  let missingInputs: string[] | undefined
  let clarificationQuestions: string[] | undefined

  if (skillId === 'xiaohongshu-cover') {
    if (!primary) throw new Error('请先选中一张图片。')
    const xiaohongshuBrief = normalizeXiaohongshuBrief(body)
    const size = sizeForAspectRatio('3:4', Math.max(420, primary.bounds.h))
    const generationJob: CanvasGenerationJob = {
      jobId: `${requestId}_job_1`,
      aspectRatio: '3:4',
      outputDir,
      outputName: `${requestId}_xiaohongshu_cover.png`,
      title: '小红书封面',
      placement: {
        x: baseX,
        y: baseY,
        ...size
      },
      note: '小红书：直出包含字体、配色、排版和标题的完整封面成品图。',
      brief: xiaohongshuBrief,
      prompt: xiaohongshuPrompt({ context, skill, userRequest, brief: xiaohongshuBrief })
    }
    brief = xiaohongshuBrief
    generationJobs = [generationJob]
  } else if (skillId === 'youtube-thumbnail') {
    if (!primary) throw new Error('请先选中一张图片。')
    const youtubeBrief = normalizeYoutubeBrief(body)
    const size = sizeForAspectRatio('16:9', 720)
    const generationJob: CanvasGenerationJob = {
      jobId: `${requestId}_job_1`,
      aspectRatio: '16:9',
      outputDir,
      outputName: `${requestId}_youtube_thumbnail.png`,
      title: 'YouTube 封面图',
      placement: {
        x: baseX,
        y: baseY,
        ...size
      },
      note: 'YouTube：直出包含字体、配色、排版和大标题的完整缩略图成品图。',
      brief: youtubeBrief,
      prompt: youtubePrompt({ context, skill, userRequest, brief: youtubeBrief })
    }
    brief = youtubeBrief
    generationJobs = [generationJob]
  } else if (skillId === 'cross-platform-adapt') {
    if (!primary) throw new Error('请先选中一张图片。')
    const crossPlatformBrief = normalizeCrossPlatformBrief(body)
    brief = crossPlatformBrief
    const gaps = crossPlatformBriefGaps(crossPlatformBrief)
    missingInputs = gaps.missingInputs.length ? gaps.missingInputs : undefined
    clarificationQuestions = gaps.clarificationQuestions.length ? gaps.clarificationQuestions : undefined
    briefStatus = gaps.missingInputs.length ? 'needs_input' : 'ready_to_generate'
    if (briefStatus === 'needs_input') {
      generationJobs = [
        pendingCrossPlatformBriefJob({
          requestId,
          outputDir,
          baseX,
          baseY,
          brief: crossPlatformBrief,
          missingInputs: gaps.missingInputs,
          clarificationQuestions: gaps.clarificationQuestions
        })
      ]
    } else {
      const selectedSpecs = crossPlatformBrief.platforms
        .map((id) => CROSS_PLATFORM_SPECS.find((spec) => spec.id === id))
        .filter(Boolean) as CrossPlatformSpec[]
      let x = baseX
      generationJobs = selectedSpecs.map((spec, index) => {
        const size = sizeForAspectRatio(spec.aspectRatio, spec.longSide)
        const job: CanvasGenerationJob = {
          jobId: `${requestId}_job_${index + 1}`,
          aspectRatio: spec.aspectRatio,
          outputDir,
          outputName: `${requestId}_${spec.id}.png`,
          title: spec.name,
          placement: {
            x,
            y: baseY,
            ...size
          },
          note: `${spec.note} ${spec.safeArea}`,
          brief: crossPlatformBrief,
          prompt: crossPlatformPrompt({
            context,
            skill,
            userRequest,
            brief: crossPlatformBrief,
            spec
          })
        }
        x += size.w + 80
        return job
      })
    }
  } else if (skillId === 'product-marketing-set') {
    if (!primary) throw new Error('请先选中一张图片。')
    const productBrief = normalizeProductMarketingBrief(body)
    const gaps = productMarketingBriefGaps(productBrief)
    brief = productBrief
    missingInputs = gaps.missingInputs.length ? gaps.missingInputs : undefined
    clarificationQuestions = gaps.clarificationQuestions.length ? gaps.clarificationQuestions : undefined
    briefStatus = gaps.missingInputs.length ? 'needs_input' : 'ready_to_generate'
    generationJobs =
      briefStatus === 'needs_input'
        ? [
            pendingProductBriefJob({
              requestId,
              outputDir,
              baseX,
              baseY,
              brief: productBrief,
              missingInputs: gaps.missingInputs,
              clarificationQuestions: gaps.clarificationQuestions
            })
          ]
        : productMarketingJobs({
            requestId,
            context,
            skill,
            userRequest,
            brief: productBrief,
            outputDir,
            baseX,
            baseY
          })
  } else if (skillId === 'logo-and-brand') {
    const logoBrief = normalizeLogoBrandBrief(body)
    const gaps = logoBrandBriefGaps(logoBrief)
    brief = logoBrief
    missingInputs = gaps.missingInputs.length ? gaps.missingInputs : undefined
    clarificationQuestions = gaps.clarificationQuestions.length ? gaps.clarificationQuestions : undefined
    briefStatus = gaps.missingInputs.length ? 'needs_input' : 'ready_to_generate'
    generationJobs =
      briefStatus === 'needs_input'
        ? [
            pendingLogoBrandBriefJob({
              requestId,
              outputDir,
              baseX,
              baseY,
              brief: logoBrief,
              missingInputs: gaps.missingInputs,
              clarificationQuestions: gaps.clarificationQuestions
            })
          ]
        : logoBrandJobs({
            requestId,
            context,
            skill,
            userRequest,
            brief: logoBrief,
            outputDir,
            baseX,
            baseY
          })
  } else if (skillId === 'marketing-brochure') {
    const brochureBrief = normalizeMarketingBrochureBrief(body)
    const gaps = marketingBrochureBriefGaps(brochureBrief)
    brief = brochureBrief
    missingInputs = gaps.missingInputs.length ? gaps.missingInputs : undefined
    clarificationQuestions = gaps.clarificationQuestions.length ? gaps.clarificationQuestions : undefined
    briefStatus = gaps.missingInputs.length ? 'needs_input' : 'ready_to_generate'
    generationJobs =
      briefStatus === 'needs_input'
        ? [
            pendingMarketingBrochureBriefJob({
              requestId,
              outputDir,
              baseX,
              baseY,
              brief: brochureBrief,
              missingInputs: gaps.missingInputs,
              clarificationQuestions: gaps.clarificationQuestions
            })
          ]
        : marketingBrochureJobs({
            requestId,
            context,
            skill,
            userRequest,
            brief: brochureBrief,
            outputDir,
            baseX,
            baseY
          })
  } else {
    throw new Error(`Unknown executable skill: ${skillId}`)
  }

  if (!generationJobs.length) throw new Error('这个 Skill 没有可执行的生成任务。')
  const generationJob = generationJobs[0]
  const createdAt = nowIso()
  const canAutoGenerate = ['logo-and-brand', 'marketing-brochure'].includes(skillId) ? true : Boolean(inputImagePath)
  const jobCount = generationJobs.length
  const skillRequest: CanvasSkillRequest = {
    requestId,
    runId,
    skillId,
    skillName: skill.name,
    status: canAutoGenerate ? 'queued' : 'needs_clarification',
    briefStatus,
    missingInputs,
    clarificationQuestions,
    canAutoGenerate,
    source: 'canvas_skill_button',
    canvasId: session.canvasId,
    targetShapeId: primary?.id,
    inputImagePath,
    inputAssetPath,
    userRequest,
    brief,
    codexInstruction: canAutoGenerate
      ? briefStatus === 'needs_input'
        ? [
            `AI Canvas ${skill.name} Skill：当前是待补充简报，不要生成图片。`,
            `请先根据 clarificationQuestions 向用户追问，补齐 missingInputs。`,
            `用户回答后，把原 brief 与用户答案合并，再调用 submit_canvas_skill_request 提交新的 ${skillId} 请求。`
          ].join(' ')
        : [
            `AI Canvas ${skill.name} Skill：请基于 inputImagePath 和 generationJobs 生成 ${jobCount} 张结果图。`,
            `逐个处理 generationJobs：每个 job 都用 job.prompt 作为生成/改图指令；若 inputImagePath 存在则作为参考图，若不存在则纯文本生成；保存到 job.outputDir/job.outputName。`,
            `每张图生成后：如果 targetShapeId 存在，调用 create_image_version；如果 targetShapeId 不存在，调用 import_image_asset 并使用 placement="absolute" 以及 job.placement.x/y/w/h。`,
            `不要另外创建画布文字层；小红书、YouTube、跨平台适配、产品营销图、Logo/品牌系统和营销宣传册中的标题、字体、配色、平台安全构图和装饰必须直接生成在成品图片里。`,
            `最后调用 save_snapshot，并用 update_skill_request 标记 completed，result 里写入每个 job 的输出路径和新 shape id。`
          ]
            .filter(Boolean)
            .join(' ')
      : '当前选中图片没有可读取的本地文件或图片数据。请提示用户用顶部「导入图片」、拖拽或粘贴重新导入后再提交 Skill。',
    generationJob,
    generationJobs,
    attempts: 0,
    createdAt,
    updatedAt: createdAt
  }
  await writeSkillRequest(skillRequest)
  await writeRun({
    runId,
    type: 'skill_run',
    model: 'external',
    input: {
      skillId,
      userRequest,
      brief,
      briefStatus,
      missingInputs,
      clarificationQuestions,
      targetShapeId: primary?.id,
      canAutoGenerate,
      inputAssetPath,
      jobCount
    },
    prompt: generationJob.prompt,
    output: {
      requestId,
      status: skillRequest.status,
      outputNames: generationJobs.map((job) => job.outputName),
      overlayActionCount: 0
    }
  })
  await persistSession()
  return skillRequest
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

function skillRequestPath(requestId: string) {
  if (!session) throw new Error('Canvas session is not open')
  const safeId = requestId.replace(/[^a-zA-Z0-9_-]/g, '_')
  const targetPath = path.join(session.storagePath, 'requests', `${safeId}.json`)
  ensureInside(session.storagePath, targetPath)
  return targetPath
}

async function writeSkillRequest(request: CanvasSkillRequest) {
  request.updatedAt = nowIso()
  await writeJson(skillRequestPath(request.requestId), request)
  if (!session) throw new Error('Canvas session is not open')
  await writeJson(path.join(session.storagePath, 'requests', 'pending_skill.json'), request)
  return request
}

async function readSkillRequest(requestId: string) {
  return readJson<CanvasSkillRequest>(skillRequestPath(requestId))
}

async function listSkillRequests(status?: EditRequestStatus) {
  if (!session) throw new Error('Canvas session is not open')
  const requestDir = path.join(session.storagePath, 'requests')
  const names = await readdir(requestDir)
  const requests = (
    await Promise.all(
      names
        .filter((name) => name.startsWith('skill_') && name.endsWith('.json'))
        .map((name) => readJson<CanvasSkillRequest>(path.join(requestDir, name)))
    )
  ).filter(Boolean) as CanvasSkillRequest[]
  return requests
    .filter((request) => (status ? request.status === status : true))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
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

  app.post('/api/canvas/import-file', async (request, response, next) => {
    try {
      if (!session) throw new Error('Canvas session is not open')
      const body = isRecord(request.body) ? request.body : {}
      const inputPath = String(body.inputPath ?? '')
      if (!inputPath) throw new Error('inputPath is required.')
      const file = await readImportFile(inputPath)
      const result = await importCanvasImage({
        buffer: file.buffer,
        source: (body.source ?? 'upload') as CanvasImageSource,
        originalName: body.title ? String(body.title) : file.originalName,
        inputPath: file.absolutePath,
        payload: body
      })
      response.json(result)
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/canvas/import-url', async (request, response, next) => {
    try {
      if (!session) throw new Error('Canvas session is not open')
      const body = isRecord(request.body) ? request.body : {}
      const rawUrl = String(body.url ?? '')
      if (!rawUrl) throw new Error('url is required.')
      const fetched = await fetchImportUrl(rawUrl)
      const result = await importCanvasImage({
        buffer: fetched.buffer,
        source: 'url',
        originalName: body.title ? String(body.title) : fetched.originalName,
        originalUrl: fetched.url,
        payload: { ...body, source: 'url' }
      })
      response.json(result)
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/canvas/import-data-url', async (request, response, next) => {
    try {
      if (!session) throw new Error('Canvas session is not open')
      const body = isRecord(request.body) ? request.body : {}
      const dataUrl = String(body.dataUrl ?? '')
      if (!dataUrl) throw new Error('dataUrl is required.')
      const parsed = parseDataUrl(dataUrl)
      const result = await importCanvasImage({
        buffer: parsed.buffer,
        source: (body.source ?? 'paste') as CanvasImageSource,
        originalName: body.title ? String(body.title) : `canvas-${body.source ?? 'paste'}`,
        payload: body
      })
      response.json(result)
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/canvas/actions', async (request, response, next) => {
    try {
      const body = isRecord(request.body) ? request.body : {}
      const actions = Array.isArray(body.actions) ? (body.actions as CanvasAction[]) : []
      if (!actions.length) throw new Error('actions are required.')
      response.json(await applyCanvasActions(actions))
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/canvas/skills', (request, response, next) => {
    try {
      const category = request.query.category ? String(request.query.category) : undefined
      response.json({
        skills: category
          ? builtinSkills.filter((skill) => skill.category === category)
          : builtinSkills
      })
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/canvas/skills/recommend', (request, response, next) => {
    try {
      const body = isRecord(request.body) ? request.body : {}
      response.json(
        recommendSkills({
          userRequest: body.userRequest ? String(body.userRequest) : undefined,
          maxResults: Number(body.maxResults ?? 5)
        })
      )
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/canvas/skills/prepare-run', async (request, response, next) => {
    try {
      const body = isRecord(request.body) ? request.body : {}
      response.json(await prepareSkillRun(body))
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/canvas/skills/run', async (request, response, next) => {
    try {
      const body = isRecord(request.body) ? request.body : {}
      const runId = String(body.runId ?? '')
      if (!runId) throw new Error('runId is required.')
      const run = await runSkillRun(runId)
      response.json({
        ...run,
        message: run.outputs?.message
      })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/canvas/skill-runs/:runId', async (request, response, next) => {
    try {
      const run = await readSkillRun(request.params.runId)
      if (!run) {
        response.status(404).json({ ok: false, error: 'Skill run not found' })
        return
      }
      response.json(run)
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/canvas/skill-request', async (request, response, next) => {
    try {
      const body = isRecord(request.body) ? request.body : {}
      const skillRequest = await submitSkillRequest(body)
      response.json({
        ...skillRequest,
        message:
          skillRequest.status === 'queued'
            ? skillRequest.briefStatus === 'needs_input'
              ? `${skillRequest.skillName} 简报已提交给 Codex，需要先补充需求。`
              : `${skillRequest.skillName} 任务已提交给 Codex。`
            : '当前图片数据无法读取，请重新导入图片后再提交。'
      })
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/canvas/skill-requests/next', async (request, response, next) => {
    try {
      if (!session) throw new Error('Canvas session is not open')
      touchCodexListener()
      const includeCompleted = request.body?.includeCompleted === true
      const queued = await listSkillRequests('queued')
      let skillRequest =
        queued[0] ?? (includeCompleted ? (await listSkillRequests()).find((item) => item.status !== 'processing') : undefined)
      if (skillRequest && request.body?.claim !== false && skillRequest.status === 'queued') {
        skillRequest = await writeSkillRequest({
          ...skillRequest,
          status: 'processing',
          attempts: skillRequest.attempts + 1,
          claimedAt: nowIso()
        })
      }
      response.json({
        request: skillRequest,
        timedOut: false,
        message: skillRequest ? 'Skill request ready.' : 'No queued Skill request.'
      })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/canvas/skill-requests/:requestId', async (request, response, next) => {
    try {
      const skillRequest = await readSkillRequest(request.params.requestId)
      if (!skillRequest) {
        response.status(404).json({ ok: false, error: 'Skill request not found' })
        return
      }
      response.json(skillRequest)
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/canvas/skill-requests/:requestId/status', async (request, response, next) => {
    try {
      touchCodexListener()
      const skillRequest = await readSkillRequest(request.params.requestId)
      if (!skillRequest) {
        response.status(404).json({ ok: false, error: 'Skill request not found' })
        return
      }
      const status = String(request.body?.status ?? skillRequest.status) as EditRequestStatus
      const nextRequest = await writeSkillRequest({
        ...skillRequest,
        status,
        error: request.body?.error ? String(request.body.error) : skillRequest.error,
        result:
          request.body?.result && typeof request.body.result === 'object'
            ? (request.body.result as Record<string, unknown>)
            : skillRequest.result,
        completedAt:
          status === 'completed' || status === 'failed' || status === 'needs_clarification'
            ? nowIso()
            : skillRequest.completedAt
      })
      response.json(nextRequest)
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
          imagePath: request.body.imagePath,
          x: request.body.x,
          y: request.body.y,
          w: request.body.w,
          h: request.body.h,
          title: request.body.title
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
    activeClient = socket
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
      if (activeClient === socket) {
        activeClient = [...clients].filter((client) => client.readyState === WebSocket.OPEN).at(-1)
      }
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

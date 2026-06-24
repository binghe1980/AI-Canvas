import type {
  Bounds,
  CanvasAction,
  CanvasActionApplyResult,
  CanvasEditRequest,
  CanvasPendingOperation,
  EditRequestQueueStatus,
  CanvasStatePayload,
  CanvasSkillCategory,
  CanvasSkillManifest,
  CanvasSkillRequest,
  ShapeSummary
} from '@ai-canvas/shared'
import {
  AssetRecordType,
  DefaultStylePanel,
  Editor,
  Tldraw,
  createShapeId,
  getSnapshot,
  toRichText
} from 'tldraw'
import {
  ArrowRight,
  Box,
  Braces,
  CheckCircle2,
  ChevronDown,
  Image as ImageIcon,
  Layers3,
  Lock,
  MousePointer2,
  PanelRightOpen,
  Save,
  Sparkles,
  SlidersHorizontal,
  Unlock,
  Upload,
  Wand2
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react'

type WsCommand = {
  type: 'command'
  id: string
  command:
    | 'create_image_holder'
    | 'import_image'
    | 'insert_image_into_holder'
    | 'create_image_version'
    | 'apply_canvas_actions'
    | 'save_snapshot'
  payload: Record<string, unknown>
}

type Status = 'connecting' | 'connected' | 'saved' | 'error'

type ImportSource = 'upload' | 'drag_drop' | 'paste'

type SkillRecommendation = {
  skillId: string
  name: string
  category: CanvasSkillCategory
  reason: string
  confidence: number
  missingInputs?: string[]
  disabledReason?: string
}

type XiaohongshuBriefForm = {
  contentType: string
  title: string
  titleStyle: string
  textPlacement: string
  focus: string
}

type YoutubeBriefForm = {
  videoTopic: string
  title: string
  audience: string
  thumbnailStyle: string
  textPlacement: string
  focus: string
}

type CrossPlatformBriefForm = {
  campaignGoal: string
  platforms: string[]
  contentKind: string
  preserve: string
  backgroundStrategy: string
  textPolicy: string
}

type ProductMarketingBriefForm = {
  platform: string
  productName: string
  targetAudience: string
  sellingPoints: string
  brandTone: string
  imageCount: string
}

type LogoBrandBriefForm = {
  brandName: string
  industry: string
  targetAudience: string
  positioning: string
  personality: string
  logoStyle: string
  usageContexts: string
  outputCount: string
}

type MarketingBrochureBriefForm = {
  format: string
  campaignName: string
  brandName: string
  targetAudience: string
  keyMessage: string
  offer: string
  callToAction: string
  visualTone: string
  outputCount: string
}

const DEFAULT_XIAOHONGSHU_BRIEF: XiaohongshuBriefForm = {
  contentType: '人像氛围',
  title: '高级感妆容',
  titleStyle: '高级克制',
  textPlacement: '顶部安全区',
  focus: '人物脸部、手势和干净质感'
}

const DEFAULT_YOUTUBE_BRIEF: YoutubeBriefForm = {
  videoTopic: '视频核心主题',
  title: '一定要看',
  audience: '泛内容观众',
  thumbnailStyle: '高对比强主体',
  textPlacement: '左侧标题区',
  focus: '人物脸部、主体轮廓和关键情绪'
}

const CROSS_PLATFORM_OPTIONS = [
  { id: 'xiaohongshu-cover', label: '小红书 3:4' },
  { id: 'instagram-feed', label: 'Instagram 4:5' },
  { id: 'instagram-story', label: 'Story/Reels 9:16' },
  { id: 'wechat-official-account', label: '公众号' },
  { id: 'twitter-article-cover', label: '推特文章封面 5:2' },
  { id: 'linkedin-square', label: 'LinkedIn 1:1' }
]

const DEFAULT_CROSS_PLATFORM_BRIEF: CrossPlatformBriefForm = {
  campaignGoal: '同一张图片适配多平台发布',
  platforms: [
    'xiaohongshu-cover',
    'instagram-feed',
    'instagram-story',
    'wechat-official-account',
    'twitter-article-cover'
  ],
  contentKind: '通用视觉',
  preserve: '主体身份、脸部、产品轮廓、核心色调',
  backgroundStrategy: '智能扩图并补干净背景',
  textPolicy: '不新增文字，只保留原图已有文字或按平台裁切重构'
}

const PRODUCT_MARKETING_PLATFORM_OPTIONS = [
  { id: 'amazon_listing', label: 'Amazon 商品页 / A+' },
  { id: 'shopify_store', label: 'Shopify / 独立站' },
  { id: 'meta_ads', label: 'Meta 广告' },
  { id: 'google_display', label: 'Google 展示广告' },
  { id: 'general_ecommerce', label: '通用电商套图' }
]

const DEFAULT_PRODUCT_MARKETING_BRIEF: ProductMarketingBriefForm = {
  platform: 'general_ecommerce',
  productName: '',
  targetAudience: '',
  sellingPoints: '',
  brandTone: '干净专业',
  imageCount: 'platform_default'
}

const DEFAULT_LOGO_BRAND_BRIEF: LogoBrandBriefForm = {
  brandName: '',
  industry: '',
  targetAudience: '',
  positioning: '',
  personality: '',
  logoStyle: '现代简洁',
  usageContexts: '官网、社媒头像、名片、产品包装',
  outputCount: 'platform_default'
}

const DEFAULT_MARKETING_BROCHURE_BRIEF: MarketingBrochureBriefForm = {
  format: 'trifold_brochure',
  campaignName: '',
  brandName: '',
  targetAudience: '',
  keyMessage: '',
  offer: '',
  callToAction: '',
  visualTone: '清晰专业',
  outputCount: 'platform_default'
}

const ASPECT_RATIO_PRESETS = [
  { label: '1:1', ratio: 1 },
  { label: '3:2', ratio: 3 / 2 },
  { label: '2:3', ratio: 2 / 3 },
  { label: '4:3', ratio: 4 / 3 },
  { label: '3:4', ratio: 3 / 4 },
  { label: '16:9', ratio: 16 / 9 },
  { label: '9:16', ratio: 9 / 16 }
]

function CollapsibleStylePanel({
  collapsed,
  onToggle,
  ...props
}: {
  collapsed: boolean
  onToggle: () => void
  [key: string]: unknown
}) {
  if (collapsed) {
    return (
      <div className="ai-style-panel ai-style-panel-collapsed">
        <button
          className="panel-icon-button"
          title="展开样式面板"
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            onToggle()
          }}
        >
          <SlidersHorizontal size={18} />
        </button>
      </div>
    )
  }

  return (
    <div className="ai-style-panel ai-style-panel-open">
      <button
        className="panel-icon-button panel-collapse-button"
        title="收起样式面板"
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          onToggle()
        }}
      >
        <SlidersHorizontal size={18} />
      </button>
      <DefaultStylePanel {...(props as any)} />
    </div>
  )
}

function getBounds(editor: Editor, shape: any): Bounds {
  const box = editor.getShapePageBounds(shape.id)
  if (box) return { x: box.x, y: box.y, w: box.w, h: box.h }
  return {
    x: shape.x ?? 0,
    y: shape.y ?? 0,
    w: shape.props?.w ?? 160,
    h: shape.props?.h ?? 120
  }
}

function extractText(editor: Editor, shape: any) {
  const utilText = (editor.getShapeUtil(shape) as any)?.getText?.(shape)
  if (typeof utilText === 'string' && utilText.trim()) return utilText.trim()
  if (typeof shape.props?.text === 'string') return shape.props.text.trim()
  if (typeof shape.props?.label === 'string') return shape.props.label.trim()
  const richText = shape.props?.richText
  if (!richText) return undefined
  const textParts: string[] = []
  const visit = (node: any) => {
    if (!node) return
    if (typeof node.text === 'string') textParts.push(node.text)
    if (Array.isArray(node.content)) node.content.forEach(visit)
  }
  visit(richText)
  return textParts.join('').trim() || undefined
}

function summarizeShape(editor: Editor, shape: any): ShapeSummary {
  const meta = shape.meta ?? {}
  const bounds = getBounds(editor, shape)
  const asset = shape.props?.assetId ? (editor.getAsset(shape.props.assetId) as any) : undefined
  const assetUrl = meta.assetUrl ?? (typeof asset?.props?.src === 'string' ? asset.props.src : undefined)
  const summary: ShapeSummary = {
    id: shape.id,
    type: shape.type,
    role: meta.aiCanvasRole,
    bounds,
    text: extractText(editor, shape),
    color: shape.props?.color,
    aspectRatio: meta.aspectRatio,
    version: meta.version,
    parentShapeId: meta.parentShapeId,
    assetPath: meta.assetPath,
    assetUrl,
    meta
  }

  if (shape.type === 'arrow') {
    const start = shape.props?.start
    const end = shape.props?.end
    if (start && end) {
      summary.arrowStart = { x: (shape.x ?? 0) + start.x, y: (shape.y ?? 0) + start.y }
      summary.arrowEnd = { x: (shape.x ?? 0) + end.x, y: (shape.y ?? 0) + end.y }
    }
  }

  return summary
}

function selectedEditorImageSummary(editor: Editor): ShapeSummary | undefined {
  const selectedShape = editor
    .getSelectedShapes()
    .find((shape: any) => shape?.type === 'image') as any
  return selectedShape ? summarizeShape(editor, selectedShape) : undefined
}

function loadImageDimensions(src: string) {
  return new Promise<{ w: number; h: number }>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve({ w: image.naturalWidth || 1024, h: image.naturalHeight || 1024 })
    image.onerror = () => reject(new Error(`Could not load image: ${src}`))
    image.src = src
  })
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

function numberOrUndefined(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}

function compactMeta(meta: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(meta).filter(([, value]) => value !== undefined))
}

function clampCanvasSize(value: number) {
  return Math.max(24, Math.min(4096, Math.round(value)))
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read image file.'))
    reader.readAsDataURL(blob)
  })
}

function fileToDataUrl(file: File) {
  return blobToDataUrl(file)
}

async function imageUrlToDataUrl(url: string) {
  if (url.startsWith('data:')) return url
  const response = await fetch(url)
  if (!response.ok) throw new Error(`无法读取当前图片：HTTP ${response.status}`)
  const blob = await response.blob()
  if (!blob.type.startsWith('image/')) throw new Error('当前选中对象不是可用图片。')
  return blobToDataUrl(blob)
}

function postJson<T>(url: string, body: unknown): Promise<T> {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(async (response) => {
    if (!response.ok) throw new Error(await response.text())
    return response.json() as Promise<T>
  })
}

function getJson<T>(url: string): Promise<T> {
  return fetch(url).then(async (response) => {
    if (!response.ok) throw new Error(await response.text())
    return response.json() as Promise<T>
  })
}

function clearEditorPage(editor: Editor) {
  const shapeIds = Array.from(editor.getCurrentPageShapeIds())
  if (shapeIds.length) editor.deleteShapes(shapeIds as any)
  editor.selectNone()
  editor.clearHistory()
}

export function App() {
  const editorRef = useRef<Editor | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const reportTimerRef = useRef<number | null>(null)
  const stateRef = useRef<CanvasStatePayload | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [state, setState] = useState<CanvasStatePayload | null>(null)
  const [status, setStatus] = useState<Status>('connecting')
  const [lastError, setLastError] = useState<string | null>(null)
  const [annotationPreview, setAnnotationPreview] = useState<string>('还没有提交修图任务。')
  const [importStatus, setImportStatus] = useState<string>('拖拽、粘贴或上传图片后，可直接调用 Skill。')
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false)
  const [queueStatus, setQueueStatus] = useState<EditRequestQueueStatus | null>(null)
  const [isSkillPanelOpen, setIsSkillPanelOpen] = useState(false)
  const [skills, setSkills] = useState<CanvasSkillManifest[]>([])
  const [skillRecommendations, setSkillRecommendations] = useState<SkillRecommendation[]>([])
  const [activeSkillCategory, setActiveSkillCategory] = useState<CanvasSkillCategory>('social_media')
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null)
  const [skillRequest, setSkillRequest] = useState('')
  const [xiaohongshuBrief, setXiaohongshuBrief] =
    useState<XiaohongshuBriefForm>(DEFAULT_XIAOHONGSHU_BRIEF)
  const [youtubeBrief, setYoutubeBrief] = useState<YoutubeBriefForm>(DEFAULT_YOUTUBE_BRIEF)
  const [crossPlatformBrief, setCrossPlatformBrief] =
    useState<CrossPlatformBriefForm>(DEFAULT_CROSS_PLATFORM_BRIEF)
  const [productMarketingBrief, setProductMarketingBrief] =
    useState<ProductMarketingBriefForm>(DEFAULT_PRODUCT_MARKETING_BRIEF)
  const [logoBrandBrief, setLogoBrandBrief] = useState<LogoBrandBriefForm>(DEFAULT_LOGO_BRAND_BRIEF)
  const [marketingBrochureBrief, setMarketingBrochureBrief] =
    useState<MarketingBrochureBriefForm>(DEFAULT_MARKETING_BROCHURE_BRIEF)
  const [skillRunPreview, setSkillRunPreview] = useState<string>('还没有运行 Skill。')
  const [skillInlineStatus, setSkillInlineStatus] = useState<string>('')
  const [isRunningSkill, setIsRunningSkill] = useState(false)
  const [isStylePanelCollapsed, setIsStylePanelCollapsed] = useState(true)
  const [isSizePanelOpen, setIsSizePanelOpen] = useState(true)
  const [isAspectLocked, setIsAspectLocked] = useState(true)
  const [selectedPanelImage, setSelectedPanelImage] = useState<ShapeSummary | undefined>(undefined)

  const selected = state?.selection.shapes ?? []
  const holders = useMemo(
    () => state?.shapes.filter((shape) => shape.role === 'image_holder') ?? [],
    [state]
  )
  const aiImages = useMemo(
    () => state?.shapes.filter((shape) => shape.role === 'ai_image') ?? [],
    [state]
  )
  const selectedImage = useMemo(
    () => selected.find((shape) => shape.role === 'ai_image') ?? selected.find((shape) => shape.type === 'image'),
    [selected]
  )
  const panelImage = selectedPanelImage ?? selectedImage
  const selectedImageSize = panelImage
    ? {
        w: Math.round(panelImage.bounds.w),
        h: Math.round(panelImage.bounds.h)
      }
    : undefined
  const selectedImageRatio = selectedImageSize ? selectedImageSize.w / selectedImageSize.h : undefined
  const tldrawComponents = useMemo(
    () => ({
      StylePanel: (props: any) => (
        <CollapsibleStylePanel
          {...props}
          collapsed={isStylePanelCollapsed}
          onToggle={() => setIsStylePanelCollapsed((value) => !value)}
        />
      )
    }),
    [isStylePanelCollapsed]
  )
  const selectedShapeKey = useMemo(
    () => selected.map((shape) => shape.id).join('|'),
    [selected]
  )
  const recommendedSkillIds = useMemo(
    () => new Set(skillRecommendations.map((item) => item.skillId)),
    [skillRecommendations]
  )
  const selectedSkill = useMemo(
    () => skills.find((skill) => skill.id === selectedSkillId) ?? null,
    [selectedSkillId, skills]
  )
  const isXiaohongshuSkill = selectedSkill?.id === 'xiaohongshu-cover'
  const isYoutubeSkill = selectedSkill?.id === 'youtube-thumbnail'
  const isCrossPlatformSkill = selectedSkill?.id === 'cross-platform-adapt'
  const isProductMarketingSkill = selectedSkill?.id === 'product-marketing-set'
  const isLogoBrandSkill = selectedSkill?.id === 'logo-and-brand'
  const isMarketingBrochureSkill = selectedSkill?.id === 'marketing-brochure'
  const selectedSkillDisabledReason = useMemo(() => {
    if (!selectedSkill) return undefined
    if (selectedSkill.disabledReason) return selectedSkill.disabledReason
    if (!selectedSkill.inputRequirements.requiresSelection) return undefined
    if (!panelImage) return '请先选中一张图片。'
    return undefined
  }, [panelImage, selectedSkill])
  const visibleSkills = useMemo(() => {
    const items = skills.filter((skill) => skill.category === activeSkillCategory)
    return [...items].sort((a, b) => {
      const aRecommended = recommendedSkillIds.has(a.id) ? 0 : 1
      const bRecommended = recommendedSkillIds.has(b.id) ? 0 : 1
      return aRecommended - bRecommended || (a.priority ?? 100) - (b.priority ?? 100)
    })
  }, [activeSkillCategory, recommendedSkillIds, skills])
  const listenerView = useMemo(() => {
    if (!queueStatus) {
      return {
        kind: 'checking',
        title: '正在检测 Codex',
        detail: '图片好了就可以开始标注，标完点“按标注修图”。'
      }
    }
    if (queueStatus.processingCount > 0) {
      return {
        kind: 'busy',
        title: 'Codex 正在修图',
        detail: '请稍等，新版会自动放到旧图右侧。'
      }
    }
    if (queueStatus.listenerActive) {
      return {
        kind: 'active',
        title: 'Codex 监听中',
        detail: '现在请在画布上标注，标完点“按标注修图”。'
      }
    }
    if (queueStatus.queuedCount > 0) {
      return {
        kind: 'paused',
        title: 'Codex 已暂停',
        detail: '任务已保存。回到 Codex 说：AI Canvas 继续自动修图。'
      }
    }
    return {
      kind: 'paused',
      title: 'Codex 已暂停',
      detail: '需要修图时，回到 Codex 说：AI Canvas 继续自动修图。'
    }
  }, [queueStatus])

  const refreshQueueStatus = useCallback(async () => {
    try {
      const nextStatus = await getJson<EditRequestQueueStatus>('/api/canvas/edit-requests/status')
      setQueueStatus(nextStatus)
      return nextStatus
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    let disposed = false
    const refresh = async () => {
      const nextStatus = await refreshQueueStatus()
      if (disposed || !nextStatus) return
      setQueueStatus(nextStatus)
    }
    void refresh()
    const interval = window.setInterval(refresh, 5000)
    return () => {
      disposed = true
      window.clearInterval(interval)
    }
  }, [refreshQueueStatus])

  const reportState = useCallback(() => {
    const editor = editorRef.current
    const socket = socketRef.current
    const currentState = stateRef.current
    if (!editor || !socket || socket.readyState !== WebSocket.OPEN || !currentState) return
    const shapes = editor.getCurrentPageShapes().map((shape) => summarizeShape(editor, shape))
    const selectedShapeIds = editor.getSelectedShapeIds().map(String)
    const selectionShapes = shapes.filter((shape) => selectedShapeIds.includes(shape.id))
    const payload: Partial<CanvasStatePayload> = {
      canvasId: currentState.canvasId,
      metadata: currentState.metadata,
      storagePath: currentState.storagePath,
      snapshot: getSnapshot(editor.store),
      shapes,
      selection: {
        canvasId: currentState.canvasId,
        pageId: currentState.metadata.activePageId,
        selectedShapeIds,
        shapes: selectionShapes
      }
    }
    socket.send(JSON.stringify({ type: 'client:state', payload }))
    const nextState = {
      ...currentState,
      shapes,
      snapshot: payload.snapshot,
      selection: payload.selection!
    }
    stateRef.current = nextState
    setState(nextState)
    setStatus('saved')
  }, [])

  const queueReportState = useCallback(() => {
    if (reportTimerRef.current) window.clearTimeout(reportTimerRef.current)
    reportTimerRef.current = window.setTimeout(reportState, 500)
  }, [reportState])

  const resizeSelectedImage = useCallback(
    (nextSize: { w: number; h: number }) => {
      const editor = editorRef.current
      if (!editor || !panelImage) return
      const shape = editor.getShape(panelImage.id as any) as any
      if (!shape || shape.type !== 'image') return
      const currentBounds = getBounds(editor, shape)
      const w = clampCanvasSize(nextSize.w)
      const h = clampCanvasSize(nextSize.h)
      editor.updateShape({
        id: shape.id,
        type: shape.type,
        x: (shape.x ?? currentBounds.x) + (currentBounds.w - w) / 2,
        y: (shape.y ?? currentBounds.y) + (currentBounds.h - h) / 2,
        props: {
          ...shape.props,
          w,
          h
        },
        meta: compactMeta({
          ...(shape.meta ?? {}),
          aspectRatio: `${w}:${h}`
        })
      } as any)
      editor.select(shape.id)
      reportState()
    },
    [panelImage, reportState]
  )

  const resizeSelectedImageWidth = useCallback(
    (rawWidth: number) => {
      if (!selectedImageSize) return
      const w = clampCanvasSize(rawWidth)
      const h = isAspectLocked ? clampCanvasSize((w * selectedImageSize.h) / selectedImageSize.w) : selectedImageSize.h
      resizeSelectedImage({ w, h })
    },
    [isAspectLocked, resizeSelectedImage, selectedImageSize]
  )

  const resizeSelectedImageHeight = useCallback(
    (rawHeight: number) => {
      if (!selectedImageSize) return
      const h = clampCanvasSize(rawHeight)
      const w = isAspectLocked ? clampCanvasSize((h * selectedImageSize.w) / selectedImageSize.h) : selectedImageSize.w
      resizeSelectedImage({ w, h })
    },
    [isAspectLocked, resizeSelectedImage, selectedImageSize]
  )

  const applySelectedImageRatio = useCallback(
    (ratio: number) => {
      if (!selectedImageSize) return
      const longSide = Math.max(selectedImageSize.w, selectedImageSize.h)
      const nextSize =
        ratio >= 1
          ? { w: longSide, h: longSide / ratio }
          : { w: longSide * ratio, h: longSide }
      resizeSelectedImage(nextSize)
    },
    [resizeSelectedImage, selectedImageSize]
  )

  const sendResponse = useCallback((id: string, ok: boolean, result?: unknown, error?: string) => {
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) return
    socket.send(JSON.stringify({ type: 'response', id, ok, result, error }))
  }, [])

  const createHolder = useCallback(
    async (payload: Record<string, unknown>) => {
      const editor = editorRef.current
      if (!editor) throw new Error('Editor is not ready')
      const shapeId = (payload.shapeId
        ? String(payload.shapeId)
        : createShapeId(`holder_${crypto.randomUUID().slice(0, 8)}`)) as any
      const x = Number(payload.x ?? 100)
      const y = Number(payload.y ?? 100)
      const w = Number(payload.w ?? 403)
      const h = Number(payload.h ?? 567)
      const label = String(payload.label ?? 'AI 图片')
      if (editor.getShape(shapeId)) {
        editor.select(shapeId)
        queueReportState()
        return { shapeId, bounds: { x, y, w, h } }
      }
      editor.createShape({
        id: shapeId,
        type: 'geo',
        x,
        y,
        props: {
          w,
          h,
          geo: 'rectangle',
          dash: 'dashed',
          color: 'blue',
          fill: 'none',
          size: 'm',
          richText: toRichText(label),
          align: 'middle',
          verticalAlign: 'middle'
        },
        meta: {
          aiCanvasRole: 'image_holder',
          aspectRatio: String(payload.aspectRatio ?? '5:7'),
          acceptsGeneratedImage: true,
          title: label
        }
      } as any)
      editor.select(shapeId)
      queueReportState()
      return { shapeId, bounds: { x, y, w, h } }
    },
    [queueReportState]
  )

  const imagePlacementBounds = useCallback(
    (payload: Record<string, unknown>, natural: { w: number; h: number }) => {
      const size = displaySize(natural.w, natural.h)
      const w = numberOrUndefined(payload.w) ?? size.w
      const h = numberOrUndefined(payload.h) ?? size.h
      const x = numberOrUndefined(payload.x)
      const y = numberOrUndefined(payload.y)
      if (x !== undefined && y !== undefined) return { x, y, w, h }

      const editor = editorRef.current
      const placement = String(payload.placement ?? 'selection_right')
      if (editor && placement === 'selection_right') {
        const selectedShape = editor.getSelectedShapes()[0] as any
        const selectedBounds = selectedShape ? getBounds(editor, selectedShape) : undefined
        if (selectedBounds) {
          return { x: selectedBounds.x + selectedBounds.w + 80, y: selectedBounds.y, w, h }
        }
      }

      const viewport = (editor as any)?.getViewportPageBounds?.()
      if (viewport) {
        return {
          x: Math.round(viewport.x + viewport.w / 2 - w / 2),
          y: Math.round(viewport.y + viewport.h / 2 - h / 2),
          w,
          h
        }
      }

      return { x: 120, y: 100, w, h }
    },
    []
  )

  const createImageShape = useCallback(
    async (payload: Record<string, unknown>) => {
      const editor = editorRef.current
      if (!editor) throw new Error('Editor is not ready')
      const assetUrl = String(payload.assetUrl)
      const natural = await loadImageDimensions(assetUrl)
      const assetId = AssetRecordType.createId()
      const imageShapeId = (payload.imageShapeId
        ? String(payload.imageShapeId)
        : createShapeId(`image_${crypto.randomUUID().slice(0, 8)}`)) as any
      const title = String(payload.title ?? 'AI 图片')
      const bounds = imagePlacementBounds(payload, natural)
      if (editor.getShape(imageShapeId)) {
        editor.select(imageShapeId)
        queueReportState()
        return {
          imageShapeId,
          assetId: undefined,
          assetPath: payload.assetPath,
          bounds,
          version: Number(payload.version ?? 1)
        }
      }
      editor.createAssets([
        {
          id: assetId,
          typeName: 'asset',
          type: 'image',
          props: {
            name: title,
            src: assetUrl,
            w: natural.w,
            h: natural.h,
            mimeType: String(payload.mimeType ?? 'image/png'),
            isAnimated: false
          },
          meta: compactMeta({
            assetPath: payload.assetPath,
            sourceRunId: payload.runId,
            skillRunId: payload.skillRunId,
            importId: payload.importId
          })
        } as any
      ])
      editor.createShape({
        id: imageShapeId,
        type: 'image',
        x: bounds.x,
        y: bounds.y,
        props: {
          assetId,
          w: bounds.w,
          h: bounds.h,
          altText: title
        },
        meta: compactMeta({
          aiCanvasRole: 'ai_image',
          holderId: payload.holderId,
          parentShapeId: payload.parentShapeId,
          sourceRunId: payload.runId,
          skillRunId: payload.skillRunId,
          version: Number(payload.version ?? 1),
          assetPath: payload.assetPath,
          assetUrl,
          imageSource: payload.imageSource ?? 'codex_generation',
          importId: payload.importId,
          usableAsSkillInput: payload.usableAsSkillInput ?? true,
          title
        })
      } as any)
      editor.bringToFront([imageShapeId])
      if (payload.selectAfterCreate !== false) editor.select(imageShapeId)
      queueReportState()
      return {
        imageShapeId,
        assetId,
        assetPath: payload.assetPath,
        assetUrl,
        bounds,
        version: Number(payload.version ?? 1)
      }
    },
    [imagePlacementBounds, queueReportState]
  )

  const importImage = useCallback(
    async (payload: Record<string, unknown>) =>
      createImageShape({
        ...payload,
        imageSource: payload.imageSource ?? payload.source ?? 'upload',
        usableAsSkillInput: true,
        title: payload.title ?? '外部导入图片'
      }),
    [createImageShape]
  )

  const insertImageIntoHolder = useCallback(
    async (payload: Record<string, unknown>) => {
      const editor = editorRef.current
      if (!editor) throw new Error('Editor is not ready')
      const holderShapeId = String(payload.holderShapeId)
      const holder = editor.getShape(holderShapeId as any) as any
      if (!holder) throw new Error(`Holder not found: ${holderShapeId}`)
      const bounds = getBounds(editor, holder)
      const assetUrl = String(payload.assetUrl)
      const natural = await loadImageDimensions(assetUrl)
      const assetId = AssetRecordType.createId()
      const imageShapeId = (payload.imageShapeId
        ? String(payload.imageShapeId)
        : createShapeId(`image_${crypto.randomUUID().slice(0, 8)}`)) as any
      const title = String(payload.title ?? holder.meta?.title ?? 'AI 图片')
      if (editor.getShape(imageShapeId)) {
        editor.select(imageShapeId)
        queueReportState()
        return {
          imageShapeId,
          assetId: undefined,
          assetPath: payload.assetPath,
          bounds,
          version: 1
        }
      }
      editor.createAssets([
        {
          id: assetId,
          typeName: 'asset',
          type: 'image',
          props: {
            name: title,
            src: assetUrl,
            w: natural.w,
            h: natural.h,
            mimeType: 'image/png',
            isAnimated: false
          },
          meta: compactMeta({
            assetPath: payload.assetPath,
            sourceRunId: payload.runId
          })
        } as any
      ])
      editor.createShape({
        id: imageShapeId,
        type: 'image',
        x: bounds.x,
        y: bounds.y,
        props: {
          assetId,
          w: bounds.w,
          h: bounds.h,
          altText: title
        },
        meta: compactMeta({
          aiCanvasRole: 'ai_image',
          holderId: holderShapeId,
          sourceRunId: payload.runId,
          version: 1,
          assetPath: payload.assetPath,
          assetUrl,
          imageSource: payload.imageSource ?? 'codex_generation',
          usableAsSkillInput: true,
          title
        })
      } as any)
      editor.bringToFront([imageShapeId])
      editor.select(imageShapeId)
      queueReportState()
      return {
        imageShapeId,
        assetId,
        assetPath: payload.assetPath,
        bounds,
        version: 1
      }
    },
    [queueReportState]
  )

  const createImageVersion = useCallback(
    async (payload: Record<string, unknown>) => {
      const editor = editorRef.current
      if (!editor) throw new Error('Editor is not ready')
      const sourceShapeId = String(payload.sourceShapeId)
      const source = editor.getShape(sourceShapeId as any) as any
      if (!source) throw new Error(`Source image not found: ${sourceShapeId}`)
      const sourceBounds = getBounds(editor, source)
      const assetUrl = String(payload.assetUrl)
      const natural = await loadImageDimensions(assetUrl)
      const assetId = AssetRecordType.createId()
      const newShapeId = (payload.newShapeId
        ? String(payload.newShapeId)
        : createShapeId(`image_${crypto.randomUUID().slice(0, 8)}`)) as any
      const sourceVersion = Number(source.meta?.version ?? 1)
      const version = Number(payload.version ?? sourceVersion + 1)
      const placement = String(payload.placement ?? 'right')
      const x =
        numberOrUndefined(payload.x) ??
        (placement === 'replace' ? sourceBounds.x : sourceBounds.x + sourceBounds.w + 80)
      const y = numberOrUndefined(payload.y) ?? sourceBounds.y
      const w = Number(payload.w ?? sourceBounds.w)
      const h = Number(payload.h ?? sourceBounds.h)
      const title = String(payload.title ?? `AI 图片 v${version}`)
      if (editor.getShape(newShapeId)) {
        editor.select(newShapeId)
        queueReportState()
        return {
          newShapeId,
          assetId: undefined,
          assetPath: payload.assetPath,
          version,
          parentShapeId: sourceShapeId
        }
      }
      editor.createAssets([
        {
          id: assetId,
          typeName: 'asset',
          type: 'image',
          props: {
            name: title,
            src: assetUrl,
            w: natural.w,
            h: natural.h,
            mimeType: 'image/png',
            isAnimated: false
          },
          meta: compactMeta({
            assetPath: payload.assetPath,
            sourceRunId: payload.runId
          })
        } as any
      ])
      editor.createShape({
        id: newShapeId,
        type: 'image',
        x,
        y,
        props: {
          assetId,
          w,
          h,
          altText: title
        },
        meta: compactMeta({
          aiCanvasRole: 'ai_image',
          holderId: source.meta?.holderId,
          parentShapeId: sourceShapeId,
          sourceRunId: payload.runId,
          skillRunId: payload.skillRunId,
          version,
          assetPath: payload.assetPath,
          assetUrl,
          imageSource: payload.imageSource ?? 'codex_generation',
          usableAsSkillInput: true,
          title
        })
      } as any)
      editor.createShape({
        id: (payload.arrowShapeId
          ? String(payload.arrowShapeId)
          : createShapeId(`version_arrow_${crypto.randomUUID().slice(0, 8)}`)) as any,
        type: 'arrow',
        x: sourceBounds.x + sourceBounds.w + 20,
        y: sourceBounds.y + sourceBounds.h / 2,
        props: {
          start: { x: 0, y: 0 },
          end: { x: 42, y: 0 },
          color: 'blue',
          size: 's',
          arrowheadEnd: 'arrow',
          text: '',
          bend: 0
        },
        meta: {
          aiCanvasRole: 'version_group',
          parentShapeId: sourceShapeId
        }
      } as any)
      editor.select(newShapeId)
      queueReportState()
      return {
        newShapeId,
        assetId,
        assetPath: payload.assetPath,
        version,
        parentShapeId: sourceShapeId,
        bounds: { x, y, w, h }
      }
    },
    [queueReportState]
  )

  const createArtboard = useCallback(
    (payload: Record<string, unknown>) => {
      const editor = editorRef.current
      if (!editor) throw new Error('Editor is not ready')
      const shapeId = (payload.shapeId
        ? String(payload.shapeId)
        : createShapeId(`artboard_${crypto.randomUUID().slice(0, 8)}`)) as any
      const x = Number(payload.x ?? 120)
      const y = Number(payload.y ?? 100)
      const w = Number(payload.w ?? 420)
      const h = Number(payload.h ?? 560)
      const title = String(payload.title ?? '画板')
      if (editor.getShape(shapeId)) return { shapeId, bounds: { x, y, w, h } }
      editor.createShape({
        id: shapeId,
        type: 'geo',
        x,
        y,
        props: {
          w,
          h,
          geo: 'rectangle',
          dash: 'draw',
          color: 'grey',
          fill: 'none',
          size: 's',
          richText: toRichText(title),
          align: 'start',
          verticalAlign: 'start'
        },
        meta: compactMeta({
          aiCanvasRole: 'artboard',
          aspectRatio: payload.aspectRatio ? String(payload.aspectRatio) : undefined,
          skillRunId: payload.skillRunId,
          title
        })
      } as any)
      queueReportState()
      return { shapeId, bounds: { x, y, w, h } }
    },
    [queueReportState]
  )

  const placeTextLikeShape = useCallback(
    (payload: Record<string, unknown>, kind: 'text' | 'note') => {
      const editor = editorRef.current
      if (!editor) throw new Error('Editor is not ready')
      const shapeId = (payload.shapeId
        ? String(payload.shapeId)
        : createShapeId(`${kind}_${crypto.randomUUID().slice(0, 8)}`)) as any
      const relativeTo = String(payload.relativeTo ?? '')
      const relativeShape =
        relativeTo === 'skill_result'
          ? editor
              .getCurrentPageShapes()
              .filter((shape: any) => shape.type === 'image')
              .find(
                (shape: any) =>
                  shape.meta?.sourceRunId === payload.skillRunId ||
                  shape.meta?.skillRunId === payload.skillRunId
              )
          : undefined
      const relativeBounds = relativeShape ? getBounds(editor, relativeShape) : undefined
      const x = relativeBounds
        ? relativeBounds.x + relativeBounds.w * Number(payload.xRatio ?? 0.08)
        : Number(payload.x ?? 120)
      const y = relativeBounds
        ? relativeBounds.y +
          relativeBounds.h * (Number(payload.yRatio ?? 0.08) + Number(payload.yOffsetRatio ?? 0))
        : Number(payload.y ?? 100)
      const w = relativeBounds
        ? relativeBounds.w * Number(payload.wRatio ?? 0.84)
        : Number(payload.w ?? 360)
      const h = Number(payload.h ?? (kind === 'note' ? 96 : 64))
      const text = String(payload.text ?? '')
      const color = String(payload.color ?? (kind === 'note' ? 'grey' : 'black'))
      const fill = String(payload.fill ?? (kind === 'note' ? 'semi' : 'none'))
      const size = String(payload.size ?? 's')
      const align = String(payload.align ?? payload.textAlign ?? 'start')
      const verticalAlign = String(payload.verticalAlign ?? 'start')
      const font = String(payload.font ?? (kind === 'note' ? 'draw' : 'sans'))
      const scale = Number(payload.scale ?? 1)
      if (editor.getShape(shapeId)) return { shapeId, bounds: { x, y, w, h } }
      if (kind === 'text') {
        editor.createShape({
          id: shapeId,
          type: 'text',
          x,
          y,
          props: {
            color,
            size,
            font,
            textAlign: align,
            w,
            richText: toRichText(text),
            scale,
            autoSize: false
          },
          meta: compactMeta({
            aiCanvasRole: 'design_text',
            title: 'Skill title',
            skillRunId: payload.skillRunId
          })
        } as any)
        queueReportState()
        return { shapeId, bounds: { x, y, w, h } }
      }
      editor.createShape({
        id: shapeId,
        type: 'geo',
        x,
        y,
        props: {
          w,
          h,
          geo: 'rectangle',
          dash: kind === 'note' ? 'dashed' : 'draw',
          color,
          fill,
          size,
          richText: toRichText(text),
          align,
          verticalAlign
        },
        meta: compactMeta({
          aiCanvasRole: 'annotation_text',
          title: kind === 'note' ? 'Skill note' : 'Skill text',
          skillRunId: payload.skillRunId
        })
      } as any)
      queueReportState()
      return { shapeId, bounds: { x, y, w, h } }
    },
    [queueReportState]
  )

  const applyCanvasActions = useCallback(
    async (actions: CanvasAction[]): Promise<CanvasActionApplyResult> => {
      const results: unknown[] = []
      for (const action of actions) {
        try {
          if (action.type === 'import_image') {
            results.push(await importImage(action.payload))
          } else if (action.type === 'create_artboard') {
            results.push(createArtboard(action.payload))
          } else if (action.type === 'place_image') {
            results.push(await createImageShape(action.payload))
          } else if (action.type === 'place_text') {
            results.push(placeTextLikeShape(action.payload, 'text'))
          } else if (action.type === 'place_note') {
            results.push(placeTextLikeShape(action.payload, 'note'))
          } else if (action.type === 'create_version') {
            results.push(await createImageVersion(action.payload))
          } else if (action.type === 'create_group') {
            results.push({ actionId: action.id, simulated: true })
          } else if (action.type === 'save_snapshot') {
            reportState()
            results.push({ saved: true })
          }
        } catch (error) {
          return {
            applied: false,
            actionCount: results.length,
            results,
            failedActionId: action.id,
            error: error instanceof Error ? error.message : String(error)
          }
        }
      }
      queueReportState()
      return { applied: true, actionCount: actions.length, results }
    },
    [
      createArtboard,
      createImageShape,
      createImageVersion,
      importImage,
      placeTextLikeShape,
      queueReportState,
      reportState
    ]
  )

  const handleCommand = useCallback(
    async (message: WsCommand) => {
      try {
        let result: unknown
        if (message.command === 'create_image_holder') result = await createHolder(message.payload)
        if (message.command === 'import_image') result = await importImage(message.payload)
        if (message.command === 'insert_image_into_holder') {
          result = await insertImageIntoHolder(message.payload)
        }
        if (message.command === 'create_image_version') {
          result = await createImageVersion(message.payload)
        }
        if (message.command === 'apply_canvas_actions') {
          const actions = Array.isArray(message.payload.actions)
            ? (message.payload.actions as CanvasAction[])
            : []
          result = await applyCanvasActions(actions)
        }
        if (message.command === 'save_snapshot') {
          reportState()
          result = { ok: true }
        }
        sendResponse(message.id, true, result)
      } catch (error) {
        const messageText = error instanceof Error ? error.message : String(error)
        setLastError(messageText)
        setStatus('error')
        sendResponse(message.id, false, undefined, messageText)
      }
    },
    [
      applyCanvasActions,
      createHolder,
      createImageVersion,
      importImage,
      insertImageIntoHolder,
      reportState,
      sendResponse
    ]
  )

  const applyPendingOperations = useCallback(
    async (operations: CanvasPendingOperation[] | undefined) => {
      if (!operations?.length) return
      const appliedIds: string[] = []
      for (const operation of operations) {
        if (operation.type === 'create_image_holder') {
          await createHolder(operation.payload)
        }
        if (operation.type === 'import_image') {
          await importImage(operation.payload)
        }
        if (operation.type === 'insert_image_into_holder') {
          await insertImageIntoHolder(operation.payload)
        }
        if (operation.type === 'create_image_version') {
          await createImageVersion(operation.payload)
        }
        if (operation.type === 'apply_canvas_actions') {
          const actions = Array.isArray(operation.payload.actions)
            ? (operation.payload.actions as CanvasAction[])
            : []
          await applyCanvasActions(actions)
        }
        appliedIds.push(operation.id)
      }
      await postJson('/api/canvas/pending-operations/clear', { ids: appliedIds })
      const currentState = stateRef.current
      if (currentState) {
        stateRef.current = { ...currentState, pendingOperations: [] }
      }
      queueReportState()
    },
    [applyCanvasActions, createHolder, createImageVersion, importImage, insertImageIntoHolder, queueReportState]
  )

  const handleMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor
      let disposed = false
      let unlisten: (() => void) | undefined
      let interval: number | undefined

      void (async () => {
        const response = await fetch('/api/canvas/state')
        const initialState = (await response.json()) as CanvasStatePayload
        if (disposed) return
        stateRef.current = initialState
        setState(initialState)
        if (initialState.snapshot) {
          try {
            editor.loadSnapshot(initialState.snapshot as any)
          } catch (error) {
            console.warn('Could not load snapshot', error)
          }
        } else {
          clearEditorPage(editor)
        }
        await applyPendingOperations(initialState.pendingOperations)
        setSelectedPanelImage(selectedEditorImageSummary(editor))

        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
        const socket = new WebSocket(`${protocol}://${window.location.host}/ws`)
        socketRef.current = socket
        socket.onopen = () => {
          setStatus('connected')
          queueReportState()
        }
        socket.onmessage = (event) => {
          const message = JSON.parse(String(event.data))
          if (message.type === 'command') void handleCommand(message)
        }
        socket.onerror = () => {
          setStatus('error')
          setLastError('WebSocket connection failed')
        }
        socket.onclose = () => {
          setStatus('connecting')
        }

        unlisten = editor.store.listen(
          () => {
            setSelectedPanelImage(selectedEditorImageSummary(editor))
            queueReportState()
          },
          { scope: 'all' } as any
        )

        interval = window.setInterval(queueReportState, 2000)
      })().catch((error) => {
        setStatus('error')
        setLastError(error instanceof Error ? error.message : String(error))
      })

      return () => {
        disposed = true
        if (interval) window.clearInterval(interval)
        unlisten?.()
        socketRef.current?.close()
      }
    },
    [applyPendingOperations, handleCommand, queueReportState]
  )

  const createDefaultHolder = async () => {
    try {
      await postJson('/api/canvas/shape', {
        label: 'AI 图片',
        aspectRatio: '5:7',
        x: 120,
        y: 100,
        w: 403,
        h: 567
      })
    } catch (error) {
      setLastError(error instanceof Error ? error.message : String(error))
      setStatus('error')
    }
  }

  const saveSnapshot = async () => {
    try {
      reportState()
      await postJson('/api/canvas/save', {})
      setStatus('saved')
    } catch (error) {
      setLastError(error instanceof Error ? error.message : String(error))
      setStatus('error')
    }
  }

  const importFile = useCallback(async (file: File, source: ImportSource, point?: { x: number; y: number }) => {
    if (!file.type.startsWith('image/')) {
      setImportStatus('只能导入 png、jpg、jpeg 或 webp 图片。')
      return
    }
    try {
      setImportStatus(`正在导入 ${file.name || '图片'}...`)
      const dataUrl = await fileToDataUrl(file)
      const body: Record<string, unknown> = {
        dataUrl,
        source,
        title: file.name || '外部导入图片',
        placement: point ? 'absolute' : 'selection_right',
        selectAfterCreate: true
      }
      if (point) {
        body.x = point.x
        body.y = point.y
      }
      const result = await postJson<{ shapeId?: string; imageShapeId?: string; message?: string }>(
        '/api/canvas/import-data-url',
        body
      )
      setImportStatus(result.message ?? '图片已导入画布，并已选中。')
      await refreshQueueStatus()
      queueReportState()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setImportStatus(`导入失败：${message}`)
      setLastError(message)
      setStatus('error')
    }
  }, [queueReportState, refreshQueueStatus])

  const handleFileInput = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) await importFile(file, 'upload')
  }

  const handleDrop = async (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    const file = Array.from(event.dataTransfer.files).find((item) => item.type.startsWith('image/'))
    if (!file) {
      setImportStatus('没有找到可导入的图片文件。')
      return
    }
    const editor = editorRef.current
    const point = (editor as any)?.screenToPage
      ? (editor as any).screenToPage({ x: event.clientX, y: event.clientY })
      : undefined
    await importFile(file, 'drag_drop', point)
  }

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
  }

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const file = Array.from(event.clipboardData?.files ?? []).find((item) =>
        item.type.startsWith('image/')
      )
      if (!file) return
      event.preventDefault()
      void importFile(file, 'paste')
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [importFile])

  const refreshSkills = useCallback(async () => {
    try {
      const result = await getJson<{ skills: CanvasSkillManifest[] }>('/api/canvas/skills')
      setSkills(result.skills)
    } catch {
      setSkills([])
    }
  }, [])

  const refreshSkillRecommendations = useCallback(async (userRequest?: string) => {
    try {
      const result = await postJson<{ recommendations: SkillRecommendation[] }>(
        '/api/canvas/skills/recommend',
        {
          userRequest,
          maxResults: 5
        }
      )
      setSkillRecommendations(result.recommendations)
    } catch {
      setSkillRecommendations([])
    }
  }, [])

  useEffect(() => {
    void refreshSkills()
  }, [refreshSkills])

  useEffect(() => {
    if (isSkillPanelOpen) void refreshSkillRecommendations(skillRequest)
  }, [isSkillPanelOpen, refreshSkillRecommendations, selectedShapeKey, skillRequest])

  const openSkillPanel = async () => {
    setIsSkillPanelOpen(true)
    setSkillInlineStatus('')
    await refreshSkills()
    await refreshSkillRecommendations(skillRequest)
  }

  const runSelectedSkill = async () => {
    if (!selectedSkill) return
    if (selectedSkillDisabledReason) {
      setSkillInlineStatus(selectedSkillDisabledReason)
      setSkillRunPreview(selectedSkillDisabledReason)
      return
    }
    try {
      setIsRunningSkill(true)
      const preparingMessage = `正在提交 ${selectedSkill.name} 给 Codex...`
      setSkillInlineStatus(preparingMessage)
      setSkillRunPreview(preparingMessage)
      const body: Record<string, unknown> = {
        skillId: selectedSkill.id,
        userRequest: skillRequest,
        selectionMode: 'current'
      }
      if (isXiaohongshuSkill) {
        body.brief = xiaohongshuBrief
      } else if (isYoutubeSkill) {
        body.brief = youtubeBrief
      } else if (isCrossPlatformSkill) {
        body.brief = crossPlatformBrief
      } else if (isProductMarketingSkill) {
        body.brief = productMarketingBrief
      } else if (isLogoBrandSkill) {
        body.brief = logoBrandBrief
      } else if (isMarketingBrochureSkill) {
        body.brief = marketingBrochureBrief
      }
      reportState()
      await new Promise((resolve) => window.setTimeout(resolve, 250))
      if (panelImage && !panelImage.assetPath && panelImage.assetUrl) {
        setSkillInlineStatus('正在把当前画布图片转换为 Codex 可用输入...')
        body.inputDataUrl = await imageUrlToDataUrl(panelImage.assetUrl)
        body.inputTitle = panelImage.meta?.title ?? panelImage.id.replace('shape:', 'skill-input')
      }
      const request = await postJson<CanvasSkillRequest & { message?: string }>('/api/canvas/skill-request', body)
      const generationJobs =
        request.generationJobs && request.generationJobs.length ? request.generationJobs : [request.generationJob]
      const needsBriefInput = request.briefStatus === 'needs_input'
      const jobCount = needsBriefInput ? 0 : generationJobs.length
      const processingHint =
        selectedSkill.id === 'cross-platform-adapt'
          ? `Codex 处理方式：按 ${jobCount} 个平台标准逐张重构、扩图或裁切，并排放到原图右侧。`
          : selectedSkill.id === 'product-marketing-set'
            ? `Codex 处理方式：按平台标准逐张生成 ${jobCount} 张产品营销图，并排放到原图右侧。`
            : selectedSkill.id === 'logo-and-brand'
              ? `Codex 处理方式：按品牌简报逐张生成 ${jobCount} 张 Logo 与品牌系统图。`
              : selectedSkill.id === 'marketing-brochure'
                ? `Codex 处理方式：按营销简报逐张生成 ${jobCount} 张宣传册与推广物料。`
              : selectedSkill.id === 'youtube-thumbnail'
                ? 'Codex 处理方式：生成 1 张包含字体、配色、排版和大标题的 16:9 成品缩略图。'
                : 'Codex 处理方式：生成 1 张包含字体、配色、排版和中文标题的小红书成品封面图。'
      const preview = [
        needsBriefInput
          ? `${selectedSkill.name} 已提交为待补充简报，Codex 会先问清需求。`
          : `${selectedSkill.name} 已提交 ${jobCount} 个真实生成请求。`,
        request.message,
        `状态：${request.status}`,
        request.briefStatus ? `简报状态：${request.briefStatus}` : undefined,
        `Request ID：${request.requestId}`,
        `Run ID：${request.runId}`,
        request.targetShapeId ? `目标图片：${request.targetShapeId}` : '目标图片：无，结果会按坐标直接放入画布。',
        request.missingInputs?.length ? `缺少信息：${request.missingInputs.join('、')}` : undefined,
        request.clarificationQuestions?.length
          ? `建议提问：\n${request.clarificationQuestions.map((question, index) => `${index + 1}. ${question}`).join('\n')}`
          : undefined,
        request.canAutoGenerate
          ? needsBriefInput
            ? 'Codex 处理方式：先在对话里补齐需求，确认后再生成套图。'
            : processingHint
          : isLogoBrandSkill || isMarketingBrochureSkill
            ? '当前请求不依赖参考图，会从品牌简报直接生成。'
            : `需要重新导入：当前图片没有可供 Codex 使用的本地文件路径。`,
        request.brief ? `Brief：${JSON.stringify(request.brief, null, 2)}` : undefined,
        '',
        needsBriefInput ? undefined : `输出：${generationJobs.map((job) => job.outputName).join('、')}`,
        needsBriefInput
          ? undefined
          : `提示词：${generationJobs
              .map((job, index) => `${index + 1}. ${job.title}\n${job.prompt}`)
              .join('\n\n')}`
      ]
        .filter(Boolean)
        .join('\n\n')
      setSkillInlineStatus(
        request.status === 'queued'
          ? needsBriefInput
            ? '已提交给 Codex。这个需求还需要补充，Codex 会先在对话里问清楚。'
            : '已提交给 Codex。若左侧正在监听，会开始生成；如果没有动静，请回到 Codex 说：AI Canvas 继续处理 Skill。'
          : '当前图片数据无法读取。请用顶部「导入图片」、拖拽或粘贴重新导入后再提交。'
      )
      setSkillRunPreview(preview)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setSkillInlineStatus(`Skill 运行失败：${message}`)
      setSkillRunPreview(`Skill 运行失败：${message}`)
      setLastError(message)
      setStatus('error')
    } finally {
      setIsRunningSkill(false)
    }
  }

  const submitAnnotationEdit = async () => {
    const target = selected.find((shape) => shape.role === 'ai_image') ?? aiImages[0]
    if (!target) {
      setAnnotationPreview('还没有可修改的 AI 图片。请先让 Codex 生成并插入一张图片。')
      return
    }
    try {
      setIsSubmittingEdit(true)
      setAnnotationPreview('正在保存这批标注，并提交给 Codex...')
      const statusBeforeSubmit = queueStatus ?? (await refreshQueueStatus())
      reportState()
      await new Promise((resolve) => window.setTimeout(resolve, 700))
      const result = await postJson<CanvasEditRequest>('/api/canvas/edit-request', {
        targetShapeId: target.id,
        radius: 420,
        includeScreenshot: true
      })
      const statusAfterSubmit = await refreshQueueStatus()
      const codexReady = Boolean(
        statusBeforeSubmit?.listenerActive ||
          statusBeforeSubmit?.processingCount ||
          statusAfterSubmit?.listenerActive ||
          statusAfterSubmit?.processingCount
      )
      const annotationLines = result.annotationPlan.length
        ? result.annotationPlan
            .map(
              (item, index) =>
                `${index + 1}. ${item.instruction}  [confidence ${Math.round(item.confidence * 100)}%]`
            )
            .join('\n')
        : '没有解析到明确标注。'
      setAnnotationPreview(
        [
          result.status === 'queued'
            ? codexReady
              ? '已提交。Codex 正在监听，会自动开始修图。'
              : '已保存这次标注。Codex 现在没有在监听，所以还不会开始修图。'
            : '这次标注还不够明确，需要先确认。',
          `任务 ID：${result.requestId}`,
          `状态：${result.status}`,
          result.clarificationReason ? `原因：${result.clarificationReason}` : undefined,
          `已解析 ${result.annotationPlan.length} 条标注。`,
          result.screenshotPath ? `参考截图：${result.screenshotPath}` : undefined,
          '',
          result.status === 'queued'
            ? codexReady
              ? '新版生成后会放到旧图右侧，旧图保留。'
              : '请回到 Codex 对话里输入：AI Canvas 继续自动修图。Codex 接上后会处理这次提交。'
            : '请补充更明确的箭头、文字或选中目标图片后再提交。',
          '',
          '解析结果：',
          annotationLines
        ]
          .filter((line) => line !== undefined)
          .join('\n')
      )
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : String(error)
      const message = rawMessage.includes('Cannot POST /api/canvas/edit-request')
        ? '当前画布服务还是旧版本。请关闭这个画布页，回到 Codex 重新打开 AI 画布后再点“按标注修图”。'
        : rawMessage
      setLastError(message)
      setStatus('error')
      setAnnotationPreview(`提交修图任务失败：${message}`)
    } finally {
      setIsSubmittingEdit(false)
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <Sparkles size={18} />
          <span>AI Canvas</span>
        </div>
        <div className="canvas-title">
          <strong>{state?.metadata.name ?? 'Untitled AI Canvas'}</strong>
          <span>{state?.canvasId ?? 'opening...'}</span>
        </div>
        <div className={`save-status save-status--${status}`}>
          <CheckCircle2 size={15} />
          {status === 'saved' ? '已保存' : status === 'connected' ? '已连接' : status === 'error' ? '错误' : '连接中'}
        </div>
        <button className="topbar-button" onClick={saveSnapshot}>
          <Save size={16} />
          保存画布
        </button>
        <input
          ref={fileInputRef}
          className="hidden-file-input"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFileInput}
        />
        <button className="topbar-button" onClick={() => fileInputRef.current?.click()}>
          <Upload size={16} />
          导入图片
        </button>
      </header>

      <aside className="sidebar sidebar-left">
        <section>
          <h2>Pages</h2>
          <button className="row row-active">
            <Layers3 size={16} />
            主画布
          </button>
        </section>
        <section>
          <h2>图片</h2>
          {aiImages.length === 0 ? (
            <p className="empty">还没有生成图片。</p>
          ) : (
            aiImages.map((image) => (
              <button className="row" key={image.id}>
                <ImageIcon size={16} />
                v{image.version ?? 1} {image.id.replace('shape:', '')}
              </button>
            ))
          )}
        </section>
        <section>
          <h2>版本</h2>
          <div className="version-chain">
            {aiImages.map((image, index) => (
              <span key={image.id}>{index > 0 ? ` -> v${image.version ?? index + 1}` : `v${image.version ?? 1}`}</span>
            ))}
          </div>
        </section>
      </aside>

      <main
        className={
          panelImage && selectedImageSize
            ? isSizePanelOpen
              ? 'canvas-stage canvas-stage-size-open'
              : 'canvas-stage canvas-stage-size-collapsed'
            : 'canvas-stage canvas-stage-size-none'
        }
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <div className="canvas-frame">
          <Tldraw onMount={handleMount} components={tldrawComponents} />
        </div>
        {panelImage && selectedImageSize ? (
          <div
            className={isSizePanelOpen ? 'image-size-panel' : 'image-size-panel image-size-panel-collapsed'}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button
              className="image-size-panel-toggle"
              title={isSizePanelOpen ? '收起尺寸面板' : '展开尺寸面板'}
              type="button"
              onClick={() => setIsSizePanelOpen((value) => !value)}
            >
              <span>尺寸</span>
              <ChevronDown size={15} />
            </button>
            {isSizePanelOpen ? (
              <>
                <div className="size-input-row">
                  <label>
                    W
                    <input
                      type="number"
                      min={24}
                      max={4096}
                      value={selectedImageSize.w}
                      onChange={(event) => resizeSelectedImageWidth(Number(event.target.value))}
                    />
                  </label>
                  <button
                    className={isAspectLocked ? 'aspect-lock aspect-lock-active' : 'aspect-lock'}
                    title={isAspectLocked ? '解除比例锁定' : '锁定比例'}
                    onClick={() => setIsAspectLocked((value) => !value)}
                  >
                    {isAspectLocked ? <Lock size={15} /> : <Unlock size={15} />}
                  </button>
                  <label>
                    H
                    <input
                      type="number"
                      min={24}
                      max={4096}
                      value={selectedImageSize.h}
                      onChange={(event) => resizeSelectedImageHeight(Number(event.target.value))}
                    />
                  </label>
                </div>
                <div className="ratio-title">比例</div>
                <div className="ratio-grid">
                  {ASPECT_RATIO_PRESETS.map((preset) => {
                    const active = selectedImageRatio
                      ? Math.abs(selectedImageRatio - preset.ratio) < 0.015
                      : false
                    return (
                      <button
                        className={active ? 'ratio-button ratio-button-active' : 'ratio-button'}
                        key={preset.label}
                        onClick={() => applySelectedImageRatio(preset.ratio)}
                      >
                        <span
                          className="ratio-icon"
                          style={
                            {
                              '--ratio-w': preset.ratio >= 1 ? '22px' : `${Math.max(10, 22 * preset.ratio)}px`,
                              '--ratio-h': preset.ratio >= 1 ? `${Math.max(10, 22 / preset.ratio)}px` : '22px'
                            } as any
                          }
                        />
                        <strong>{preset.label}</strong>
                      </button>
                    )
                  })}
                </div>
              </>
            ) : null}
          </div>
        ) : null}
        <div className="floating-toolbar">
          <button title="Select">
            <MousePointer2 size={18} />
          </button>
          <button title="新建图片框" onClick={createDefaultHolder}>
            <Box size={18} />
          </button>
          <button title="保存画布" onClick={saveSnapshot}>
            <Save size={18} />
          </button>
          <button title="打开 Skill 面板" onClick={openSkillPanel}>
            <PanelRightOpen size={18} />
          </button>
        </div>
      </main>

      <aside className="sidebar sidebar-right">
        <section>
          <h2>图片导入</h2>
          <button className="primary-action" onClick={() => fileInputRef.current?.click()}>
            <Upload size={16} />
            上传图片
          </button>
          <p className="empty">{importStatus}</p>
        </section>
        <section>
          <h2>AI 操作</h2>
          <div className={`listener-card listener-card--${listenerView.kind}`}>
            <strong>{listenerView.title}</strong>
            <span>{listenerView.detail}</span>
          </div>
          <button className="primary-action" onClick={createDefaultHolder}>
            <Box size={16} />
            新建图片框
          </button>
          <button className="action" onClick={submitAnnotationEdit}>
            <Wand2 size={16} />
            {isSubmittingEdit ? '正在提交' : '按标注修图'}
          </button>
          <details className="advanced-actions">
            <summary>更多操作</summary>
            <button className="action" onClick={saveSnapshot}>
              <Save size={16} />
              保存画布
            </button>
          </details>
        </section>
        <section>
          <h2>Skills</h2>
          <button className="action" onClick={openSkillPanel}>
            <PanelRightOpen size={16} />
            打开 Skill 面板
          </button>
          {isSkillPanelOpen ? (
            <div className="skill-panel">
              <div className="skill-tabs" role="tablist" aria-label="Skill categories">
                {(['social_media', 'e_commerce', 'branding', 'marketing', 'studio'] as CanvasSkillCategory[]).map(
                  (category) => (
                    <button
                      className={category === activeSkillCategory ? 'skill-tab skill-tab-active' : 'skill-tab'}
                      key={category}
                      onClick={() => setActiveSkillCategory(category)}
                    >
                      {category.replace('_', ' ')}
                    </button>
                  )
                )}
              </div>
              <div className="skill-list">
                {visibleSkills.length === 0 ? (
                  <p className="empty">这个分类还没有 Skill。</p>
                ) : (
                  visibleSkills.map((skill) => {
                    const recommendation = skillRecommendations.find((item) => item.skillId === skill.id)
                    const disabledReason =
                      skill.disabledReason ??
                      recommendation?.disabledReason ??
                      (!panelImage && skill.inputRequirements.requiresSelection ? '请先选中一张图片。' : undefined)
                    const disabled = Boolean(skill.disabled || disabledReason)
                    return (
                      <button
                        className={
                          selectedSkillId === skill.id
                            ? 'skill-row skill-row-active'
                            : recommendedSkillIds.has(skill.id)
                              ? 'skill-row skill-row-recommended'
                              : 'skill-row'
                        }
                        disabled={disabled}
                        key={skill.id}
                        onClick={() => setSelectedSkillId(skill.id)}
                      >
                        <span>
                          <strong>{skill.name}</strong>
                          <small>{disabledReason ?? recommendation?.reason ?? skill.description}</small>
                        </span>
                        {recommendedSkillIds.has(skill.id) ? <Sparkles size={15} /> : <ChevronDown size={15} />}
                      </button>
                    )
                  })
                )}
              </div>
              {selectedSkill ? (
                <div className="skill-confirm">
                  <strong>{selectedSkill.name}</strong>
                  <span>{selectedSkill.description}</span>
                  {isXiaohongshuSkill ? (
                    <div className="skill-brief-grid">
                      <label>
                        内容类型
                        <select
                          value={xiaohongshuBrief.contentType}
                          onChange={(event) =>
                            setXiaohongshuBrief((current) => ({
                              ...current,
                              contentType: event.target.value
                            }))
                          }
                        >
                          <option>人像氛围</option>
                          <option>种草推荐</option>
                          <option>教程干货</option>
                          <option>产品卖点</option>
                          <option>探店生活方式</option>
                        </select>
                      </label>
                      <label>
                        主标题
                        <input
                          value={xiaohongshuBrief.title}
                          onChange={(event) =>
                            setXiaohongshuBrief((current) => ({
                              ...current,
                              title: event.target.value
                            }))
                          }
                          placeholder="例如：高级感妆容"
                        />
                      </label>
                      <label>
                        标题风格
                        <select
                          value={xiaohongshuBrief.titleStyle}
                          onChange={(event) =>
                            setXiaohongshuBrief((current) => ({
                              ...current,
                              titleStyle: event.target.value
                            }))
                          }
                        >
                          <option>高级克制</option>
                          <option>杂志感</option>
                          <option>强点击</option>
                          <option>生活方式</option>
                          <option>极简留白</option>
                        </select>
                      </label>
                      <label>
                        标题位置
                        <select
                          value={xiaohongshuBrief.textPlacement}
                          onChange={(event) =>
                            setXiaohongshuBrief((current) => ({
                              ...current,
                              textPlacement: event.target.value
                            }))
                          }
                        >
                          <option>顶部安全区</option>
                          <option>左上角</option>
                          <option>右上角</option>
                          <option>底部安全区</option>
                          <option>自动找留白</option>
                        </select>
                      </label>
                      <label className="skill-brief-wide">
                        保留重点
                        <input
                          value={xiaohongshuBrief.focus}
                          onChange={(event) =>
                            setXiaohongshuBrief((current) => ({
                              ...current,
                              focus: event.target.value
                            }))
                          }
                          placeholder="例如：人物脸部、手势、产品轮廓"
                        />
                      </label>
                    </div>
                  ) : null}
                  {isYoutubeSkill ? (
                    <div className="skill-brief-grid">
                      <label className="skill-brief-wide">
                        视频主题
                        <input
                          value={youtubeBrief.videoTopic}
                          onChange={(event) =>
                            setYoutubeBrief((current) => ({
                              ...current,
                              videoTopic: event.target.value
                            }))
                          }
                          placeholder="例如：3 分钟学会高级感妆容"
                        />
                      </label>
                      <label>
                        大标题
                        <input
                          value={youtubeBrief.title}
                          onChange={(event) =>
                            setYoutubeBrief((current) => ({
                              ...current,
                              title: event.target.value
                            }))
                          }
                          placeholder="例如：高级感妆容"
                        />
                      </label>
                      <label>
                        目标观众
                        <input
                          value={youtubeBrief.audience}
                          onChange={(event) =>
                            setYoutubeBrief((current) => ({
                              ...current,
                              audience: event.target.value
                            }))
                          }
                          placeholder="例如：新手、职场女性、摄影爱好者"
                        />
                      </label>
                      <label>
                        缩略图风格
                        <select
                          value={youtubeBrief.thumbnailStyle}
                          onChange={(event) =>
                            setYoutubeBrief((current) => ({
                              ...current,
                              thumbnailStyle: event.target.value
                            }))
                          }
                        >
                          <option>高对比强主体</option>
                          <option>专业频道感</option>
                          <option>情绪悬念</option>
                          <option>干净教程感</option>
                          <option>电影感</option>
                        </select>
                      </label>
                      <label>
                        标题位置
                        <select
                          value={youtubeBrief.textPlacement}
                          onChange={(event) =>
                            setYoutubeBrief((current) => ({
                              ...current,
                              textPlacement: event.target.value
                            }))
                          }
                        >
                          <option>左侧标题区</option>
                          <option>右侧标题区</option>
                          <option>底部标题区</option>
                        </select>
                      </label>
                      <label className="skill-brief-wide">
                        保留重点
                        <input
                          value={youtubeBrief.focus}
                          onChange={(event) =>
                            setYoutubeBrief((current) => ({
                              ...current,
                              focus: event.target.value
                            }))
                          }
                          placeholder="例如：人物表情、产品、关键动作"
                        />
                      </label>
                    </div>
                  ) : null}
                  {isCrossPlatformSkill ? (
                    <div className="skill-brief-grid">
                      <label className="skill-brief-wide">
                        发布目标
                        <input
                          value={crossPlatformBrief.campaignGoal}
                          onChange={(event) =>
                            setCrossPlatformBrief((current) => ({
                              ...current,
                              campaignGoal: event.target.value
                            }))
                          }
                          placeholder="例如：同一组视觉用于多平台预热发布"
                        />
                      </label>
                      <label>
                        内容类型
                        <select
                          value={crossPlatformBrief.contentKind}
                          onChange={(event) =>
                            setCrossPlatformBrief((current) => ({
                              ...current,
                              contentKind: event.target.value
                            }))
                          }
                        >
                          <option>通用视觉</option>
                          <option>人像内容</option>
                          <option>产品图片</option>
                          <option>品牌海报</option>
                          <option>教程封面</option>
                          <option>活动推广</option>
                        </select>
                      </label>
                      <label>
                        文字处理
                        <select
                          value={crossPlatformBrief.textPolicy}
                          onChange={(event) =>
                            setCrossPlatformBrief((current) => ({
                              ...current,
                              textPolicy: event.target.value
                            }))
                          }
                        >
                          <option>不新增文字，只保留原图已有文字或按平台裁切重构</option>
                          <option>保留并重排原图已有文字</option>
                          <option>按补充要求添加短标题</option>
                          <option>去除原有杂乱文字，输出干净视觉</option>
                        </select>
                      </label>
                      <div className="skill-brief-wide platform-check-grid">
                        {CROSS_PLATFORM_OPTIONS.map((platform) => (
                          <label key={platform.id} className="platform-check">
                            <input
                              type="checkbox"
                              checked={crossPlatformBrief.platforms.includes(platform.id)}
                              onChange={(event) =>
                                setCrossPlatformBrief((current) => {
                                  const nextPlatforms = event.target.checked
                                    ? [...current.platforms, platform.id]
                                    : current.platforms.filter((id) => id !== platform.id)
                                  return {
                                    ...current,
                                    platforms: nextPlatforms.length ? nextPlatforms : [platform.id]
                                  }
                                })
                              }
                            />
                            <span>{platform.label}</span>
                          </label>
                        ))}
                      </div>
                      <label className="skill-brief-wide">
                        必须保留
                        <input
                          value={crossPlatformBrief.preserve}
                          onChange={(event) =>
                            setCrossPlatformBrief((current) => ({
                              ...current,
                              preserve: event.target.value
                            }))
                          }
                          placeholder="例如：人物身份、脸部、产品轮廓、品牌色"
                        />
                      </label>
                      <label className="skill-brief-wide">
                        背景处理
                        <select
                          value={crossPlatformBrief.backgroundStrategy}
                          onChange={(event) =>
                            setCrossPlatformBrief((current) => ({
                              ...current,
                              backgroundStrategy: event.target.value
                            }))
                          }
                        >
                          <option>智能扩图并补干净背景</option>
                          <option>保留原背景并轻微重构</option>
                          <option>替换为平台适配背景</option>
                          <option>极简留白背景</option>
                        </select>
                      </label>
                    </div>
                  ) : null}
                  {isProductMarketingSkill ? (
                    <div className="skill-brief-grid">
                      <label className="skill-brief-wide">
                        平台 / 场景
                        <select
                          value={productMarketingBrief.platform}
                          onChange={(event) =>
                            setProductMarketingBrief((current) => ({
                              ...current,
                              platform: event.target.value
                            }))
                          }
                        >
                          {PRODUCT_MARKETING_PLATFORM_OPTIONS.map((platform) => (
                            <option key={platform.id} value={platform.id}>
                              {platform.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        产品名称
                        <input
                          value={productMarketingBrief.productName}
                          onChange={(event) =>
                            setProductMarketingBrief((current) => ({
                              ...current,
                              productName: event.target.value
                            }))
                          }
                          placeholder="例如：无线降噪耳机"
                        />
                      </label>
                      <label>
                        目标用户
                        <input
                          value={productMarketingBrief.targetAudience}
                          onChange={(event) =>
                            setProductMarketingBrief((current) => ({
                              ...current,
                              targetAudience: event.target.value
                            }))
                          }
                          placeholder="例如：通勤白领、学生党"
                        />
                      </label>
                      <label className="skill-brief-wide">
                        核心卖点
                        <textarea
                          value={productMarketingBrief.sellingPoints}
                          onChange={(event) =>
                            setProductMarketingBrief((current) => ({
                              ...current,
                              sellingPoints: event.target.value
                            }))
                          }
                          placeholder="写 1-3 个卖点，例如：40 小时续航；轻量佩戴；通话降噪"
                        />
                      </label>
                      <label>
                        视觉语气
                        <select
                          value={productMarketingBrief.brandTone}
                          onChange={(event) =>
                            setProductMarketingBrief((current) => ({
                              ...current,
                              brandTone: event.target.value
                            }))
                          }
                        >
                          <option>干净专业</option>
                          <option>高端科技</option>
                          <option>生活方式</option>
                          <option>年轻活力</option>
                          <option>极简高级</option>
                        </select>
                      </label>
                      <label>
                        输出数量
                        <select
                          value={productMarketingBrief.imageCount}
                          onChange={(event) =>
                            setProductMarketingBrief((current) => ({
                              ...current,
                              imageCount: event.target.value
                            }))
                          }
                        >
                          <option value="platform_default">按平台推荐</option>
                          <option value="3">3 张</option>
                          <option value="5">5 张</option>
                          <option value="6">6 张</option>
                        </select>
                      </label>
                    </div>
                  ) : null}
                  {isLogoBrandSkill ? (
                    <div className="skill-brief-grid">
                      <label>
                        品牌名
                        <input
                          value={logoBrandBrief.brandName}
                          onChange={(event) =>
                            setLogoBrandBrief((current) => ({
                              ...current,
                              brandName: event.target.value
                            }))
                          }
                          placeholder="例如：Movo"
                        />
                      </label>
                      <label>
                        行业 / 品类
                        <input
                          value={logoBrandBrief.industry}
                          onChange={(event) =>
                            setLogoBrandBrief((current) => ({
                              ...current,
                              industry: event.target.value
                            }))
                          }
                          placeholder="例如：AI 写作工具"
                        />
                      </label>
                      <label className="skill-brief-wide">
                        目标受众
                        <input
                          value={logoBrandBrief.targetAudience}
                          onChange={(event) =>
                            setLogoBrandBrief((current) => ({
                              ...current,
                              targetAudience: event.target.value
                            }))
                          }
                          placeholder="例如：内容创作者、独立开发者、小团队"
                        />
                      </label>
                      <label className="skill-brief-wide">
                        定位 / 差异点
                        <textarea
                          value={logoBrandBrief.positioning}
                          onChange={(event) =>
                            setLogoBrandBrief((current) => ({
                              ...current,
                              positioning: event.target.value
                            }))
                          }
                          placeholder="这个品牌和同类产品相比，最想被记住的特点是什么？"
                        />
                      </label>
                      <label>
                        品牌人格
                        <input
                          value={logoBrandBrief.personality}
                          onChange={(event) =>
                            setLogoBrandBrief((current) => ({
                              ...current,
                              personality: event.target.value
                            }))
                          }
                          placeholder="例如：可靠、聪明、轻松"
                        />
                      </label>
                      <label>
                        Logo 风格
                        <select
                          value={logoBrandBrief.logoStyle}
                          onChange={(event) =>
                            setLogoBrandBrief((current) => ({
                              ...current,
                              logoStyle: event.target.value
                            }))
                          }
                        >
                          <option>现代简洁</option>
                          <option>几何科技</option>
                          <option>高级极简</option>
                          <option>友好圆润</option>
                          <option>复古精品</option>
                          <option>东方气质</option>
                        </select>
                      </label>
                      <label className="skill-brief-wide">
                        使用场景
                        <input
                          value={logoBrandBrief.usageContexts}
                          onChange={(event) =>
                            setLogoBrandBrief((current) => ({
                              ...current,
                              usageContexts: event.target.value
                            }))
                          }
                          placeholder="例如：官网、社媒头像、名片、产品包装"
                        />
                      </label>
                      <label>
                        输出数量
                        <select
                          value={logoBrandBrief.outputCount}
                          onChange={(event) =>
                            setLogoBrandBrief((current) => ({
                              ...current,
                              outputCount: event.target.value
                            }))
                          }
                        >
                          <option value="platform_default">按品牌系统推荐</option>
                          <option value="3">3 张</option>
                          <option value="5">5 张</option>
                        </select>
                      </label>
                    </div>
                  ) : null}
                  {isMarketingBrochureSkill ? (
                    <div className="skill-brief-grid">
                      <label className="skill-brief-wide">
                        物料类型
                        <select
                          value={marketingBrochureBrief.format}
                          onChange={(event) =>
                            setMarketingBrochureBrief((current) => ({
                              ...current,
                              format: event.target.value
                            }))
                          }
                        >
                          <option value="trifold_brochure">三折页宣传册</option>
                          <option value="service_brochure">服务介绍册</option>
                          <option value="event_campaign">活动推广册</option>
                          <option value="product_brochure">产品推广册</option>
                        </select>
                      </label>
                      <label>
                        活动 / 产品
                        <input
                          value={marketingBrochureBrief.campaignName}
                          onChange={(event) =>
                            setMarketingBrochureBrief((current) => ({
                              ...current,
                              campaignName: event.target.value
                            }))
                          }
                          placeholder="例如：春季课程开放日"
                        />
                      </label>
                      <label>
                        品牌名
                        <input
                          value={marketingBrochureBrief.brandName}
                          onChange={(event) =>
                            setMarketingBrochureBrief((current) => ({
                              ...current,
                              brandName: event.target.value
                            }))
                          }
                          placeholder="例如：北辰学院"
                        />
                      </label>
                      <label className="skill-brief-wide">
                        目标受众
                        <input
                          value={marketingBrochureBrief.targetAudience}
                          onChange={(event) =>
                            setMarketingBrochureBrief((current) => ({
                              ...current,
                              targetAudience: event.target.value
                            }))
                          }
                          placeholder="例如：准备申请国际学校的初中家庭"
                        />
                      </label>
                      <label className="skill-brief-wide">
                        核心信息
                        <textarea
                          value={marketingBrochureBrief.keyMessage}
                          onChange={(event) =>
                            setMarketingBrochureBrief((current) => ({
                              ...current,
                              keyMessage: event.target.value
                            }))
                          }
                          placeholder="这份宣传册最想让用户记住什么？"
                        />
                      </label>
                      <label className="skill-brief-wide">
                        优惠 / 内容点
                        <textarea
                          value={marketingBrochureBrief.offer}
                          onChange={(event) =>
                            setMarketingBrochureBrief((current) => ({
                              ...current,
                              offer: event.target.value
                            }))
                          }
                          placeholder="例如：课程亮点、服务流程、价格权益、报名福利"
                        />
                      </label>
                      <label>
                        行动号召
                        <input
                          value={marketingBrochureBrief.callToAction}
                          onChange={(event) =>
                            setMarketingBrochureBrief((current) => ({
                              ...current,
                              callToAction: event.target.value
                            }))
                          }
                          placeholder="例如：扫码预约试听"
                        />
                      </label>
                      <label>
                        视觉语气
                        <select
                          value={marketingBrochureBrief.visualTone}
                          onChange={(event) =>
                            setMarketingBrochureBrief((current) => ({
                              ...current,
                              visualTone: event.target.value
                            }))
                          }
                        >
                          <option>清晰专业</option>
                          <option>高端可信</option>
                          <option>活动热烈</option>
                          <option>年轻活力</option>
                          <option>极简商务</option>
                          <option>温暖亲和</option>
                        </select>
                      </label>
                      <label>
                        输出数量
                        <select
                          value={marketingBrochureBrief.outputCount}
                          onChange={(event) =>
                            setMarketingBrochureBrief((current) => ({
                              ...current,
                              outputCount: event.target.value
                            }))
                          }
                        >
                          <option value="platform_default">按宣传册推荐</option>
                          <option value="2">2 张</option>
                          <option value="3">3 张</option>
                          <option value="4">4 张</option>
                        </select>
                      </label>
                    </div>
                  ) : null}
                  <textarea
                    value={skillRequest}
                    onChange={(event) => setSkillRequest(event.target.value)}
                    placeholder={
                      isXiaohongshuSkill
                        ? '补充要求，例如：背景更干净，保留人物脸部，不要太商业海报感。'
                        : isYoutubeSkill
                          ? '补充要求，例如：更像专业知识频道，不要夸张表情，标题区更干净。'
                          : isCrossPlatformSkill
                            ? '补充要求，例如：所有平台都保留人物脸部，Story 顶底不要放字，YouTube 右下角避开信息。'
                            : isProductMarketingSkill
                              ? '补充要求，例如：图片要适合夏季上新，少放字，重点突出材质和使用场景。'
                              : isLogoBrandSkill
                                ? '补充要求，例如：不要太像现有大厂，适合 app 图标，中文品牌名可作为副标。'
                                : isMarketingBrochureSkill
                                  ? '补充要求，例如：更像高端教育机构，不要堆太多小字，CTA 要明显。'
                                  : '可补充一句要求，例如：更高级一点，标题别太吵。'
                    }
                  />
                  <button
                    className="primary-action"
                    onClick={runSelectedSkill}
                    disabled={isRunningSkill || Boolean(selectedSkillDisabledReason)}
                  >
                    <Wand2 size={16} />
                    {isRunningSkill ? '正在提交...' : '提交给 Codex 生成'}
                  </button>
                  {(skillInlineStatus || selectedSkillDisabledReason) && (
                    <pre className="skill-inline-status">
                      {skillInlineStatus || selectedSkillDisabledReason}
                    </pre>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
        <section>
          <h2>选中内容</h2>
          {selected.length === 0 ? (
            <p className="empty">当前没有选中内容。</p>
          ) : (
            selected.map((shape) => (
              <div className="metadata-card" key={shape.id}>
                <div>
                  <strong>{shape.role ?? shape.type}</strong>
                  <span>{shape.id}</span>
                </div>
                <code>
                  {Math.round(shape.bounds.w)} x {Math.round(shape.bounds.h)}
                </code>
              </div>
            ))
          )}
        </section>
        <section>
          <h2>任务记录</h2>
          <pre className="json-preview">{annotationPreview}</pre>
          <pre className="json-preview">{skillRunPreview}</pre>
        </section>
        <section>
          <h2>保存位置</h2>
          <p className="path-text">{state?.storagePath ?? 'Opening canvas storage...'}</p>
          {lastError ? <p className="error-text">{lastError}</p> : null}
        </section>
      </aside>

      <footer className="statusbar">
        <span>{holders.length} holders</span>
        <span>{aiImages.length} AI images</span>
        <span>{state?.shapes.length ?? 0} shapes</span>
        <span className="statusbar-command">
          <Braces size={14} />
          MCP 已就绪
        </span>
        <span>
          <ArrowRight size={14} />
          新版会放到右侧
        </span>
      </footer>
    </div>
  )
}

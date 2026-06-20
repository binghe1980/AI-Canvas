import type {
  Bounds,
  CanvasEditRequest,
  CanvasPendingOperation,
  EditRequestQueueStatus,
  CanvasStatePayload,
  ShapeSummary
} from '@ai-canvas/shared'
import {
  AssetRecordType,
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
  Image as ImageIcon,
  Layers3,
  MousePointer2,
  Save,
  Sparkles,
  Wand2
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type WsCommand = {
  type: 'command'
  id: string
  command:
    | 'create_image_holder'
    | 'insert_image_into_holder'
    | 'create_image_version'
    | 'save_snapshot'
  payload: Record<string, unknown>
}

type Status = 'connecting' | 'connected' | 'saved' | 'error'

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
    assetUrl: meta.assetUrl,
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

function loadImageDimensions(src: string) {
  return new Promise<{ w: number; h: number }>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve({ w: image.naturalWidth || 1024, h: image.naturalHeight || 1024 })
    image.onerror = () => reject(new Error(`Could not load image: ${src}`))
    image.src = src
  })
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
  const [state, setState] = useState<CanvasStatePayload | null>(null)
  const [status, setStatus] = useState<Status>('connecting')
  const [lastError, setLastError] = useState<string | null>(null)
  const [annotationPreview, setAnnotationPreview] = useState<string>('还没有提交修图任务。')
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false)
  const [queueStatus, setQueueStatus] = useState<EditRequestQueueStatus | null>(null)

  const selected = state?.selection.shapes ?? []
  const holders = useMemo(
    () => state?.shapes.filter((shape) => shape.role === 'image_holder') ?? [],
    [state]
  )
  const aiImages = useMemo(
    () => state?.shapes.filter((shape) => shape.role === 'ai_image') ?? [],
    [state]
  )
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
          meta: {
            assetPath: payload.assetPath,
            sourceRunId: payload.runId
          }
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
        meta: {
          aiCanvasRole: 'ai_image',
          holderId: holderShapeId,
          sourceRunId: payload.runId,
          version: 1,
          assetPath: payload.assetPath,
          assetUrl,
          title
        }
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
      const x = placement === 'replace' ? sourceBounds.x : sourceBounds.x + sourceBounds.w + 80
      const y = sourceBounds.y
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
          meta: {
            assetPath: payload.assetPath,
            sourceRunId: payload.runId
          }
        } as any
      ])
      editor.createShape({
        id: newShapeId,
        type: 'image',
        x,
        y,
        props: {
          assetId,
          w: sourceBounds.w,
          h: sourceBounds.h,
          altText: title
        },
        meta: {
          aiCanvasRole: 'ai_image',
          holderId: source.meta?.holderId,
          parentShapeId: sourceShapeId,
          sourceRunId: payload.runId,
          version,
          assetPath: payload.assetPath,
          assetUrl,
          title
        }
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
        parentShapeId: sourceShapeId
      }
    },
    [queueReportState]
  )

  const handleCommand = useCallback(
    async (message: WsCommand) => {
      try {
        let result: unknown
        if (message.command === 'create_image_holder') result = await createHolder(message.payload)
        if (message.command === 'insert_image_into_holder') {
          result = await insertImageIntoHolder(message.payload)
        }
        if (message.command === 'create_image_version') {
          result = await createImageVersion(message.payload)
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
    [createHolder, createImageVersion, insertImageIntoHolder, reportState, sendResponse]
  )

  const applyPendingOperations = useCallback(
    async (operations: CanvasPendingOperation[] | undefined) => {
      if (!operations?.length) return
      const appliedIds: string[] = []
      for (const operation of operations) {
        if (operation.type === 'create_image_holder') {
          await createHolder(operation.payload)
        }
        if (operation.type === 'insert_image_into_holder') {
          await insertImageIntoHolder(operation.payload)
        }
        if (operation.type === 'create_image_version') {
          await createImageVersion(operation.payload)
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
    [createHolder, createImageVersion, insertImageIntoHolder, queueReportState]
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

      <main className="canvas-stage">
        <div className="canvas-frame">
          <Tldraw persistenceKey="ai-canvas-local" onMount={handleMount} />
        </div>
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
        </div>
      </main>

      <aside className="sidebar sidebar-right">
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

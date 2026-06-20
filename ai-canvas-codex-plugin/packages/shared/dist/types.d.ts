export type AiCanvasRole = 'image_holder' | 'ai_image' | 'annotation_text' | 'annotation_arrow' | 'annotation_mark' | 'version_group';
export interface Bounds {
    x: number;
    y: number;
    w: number;
    h: number;
}
export interface Point {
    x: number;
    y: number;
}
export interface CanvasMetadata {
    canvasId: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    workspaceRoot: string;
    activePageId: string;
    appVersion: string;
}
export interface AiCanvasShapeMeta {
    aiCanvasRole?: AiCanvasRole;
    aspectRatio?: string;
    acceptsGeneratedImage?: boolean;
    holderId?: string;
    sourceRunId?: string;
    version?: number;
    parentShapeId?: string;
    assetPath?: string;
    title?: string;
}
export interface ShapeSummary {
    id: string;
    type: string;
    role?: AiCanvasRole;
    bounds: Bounds;
    text?: string;
    color?: string;
    assetPath?: string;
    assetUrl?: string;
    aspectRatio?: string;
    version?: number;
    parentShapeId?: string;
    arrowStart?: Point;
    arrowEnd?: Point;
    meta?: AiCanvasShapeMeta;
}
export interface SelectionSnapshot {
    canvasId: string;
    pageId: string;
    selectedShapeIds: string[];
    shapes: ShapeSummary[];
}
export interface ImageGenerationRequest {
    prompt: string;
    aspectRatio?: string;
    width?: number;
    height?: number;
    referenceImages?: string[];
    outputDir: string;
    outputName?: string;
}
export interface ImageEditRequest {
    prompt: string;
    inputImagePath: string;
    annotatedScreenshotPath?: string;
    annotations?: AnnotationInstruction[];
    maskPath?: string;
    outputDir: string;
    outputName?: string;
}
export interface ImageResult {
    imagePath: string;
    width: number;
    height: number;
    model: 'codex-image-2.0';
    raw?: unknown;
}
export interface AnnotationInstruction {
    id: string;
    instruction: string;
    region: Bounds;
    sourceShapeIds: string[];
    confidence: number;
    kind: 'arrow_text' | 'circle_text' | 'box_text' | 'draw_mark' | 'text_near_image';
}
export interface AnnotationPlanResult {
    targetShapeId: string;
    targetImagePath?: string;
    annotationPlan: AnnotationInstruction[];
    screenshotPath?: string;
    needsClarification: boolean;
    clarificationReason?: string;
}
export interface PreparedImageGeneration {
    readyToGenerate: boolean;
    needsCanvasOpen: boolean;
    message: string;
    url: string;
    canvasId: string;
    storagePath: string;
    holderShapeId?: string;
    holderBounds?: Bounds;
    aspectRatio: string;
    outputDir: string;
    suggestedPrompt: string;
}
export interface PreparedAnnotationEdit extends AnnotationPlanResult {
    readyToEdit: boolean;
    url?: string;
    storagePath: string;
    inputImagePath?: string;
    editPrompt: string;
}
export type EditRequestStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'needs_clarification';
export interface CanvasEditRequest extends PreparedAnnotationEdit {
    requestId: string;
    status: EditRequestStatus;
    canAutoEdit: boolean;
    source: 'canvas_button' | 'codex';
    userRequest?: string;
    codexInstruction: string;
    attempts: number;
    createdAt: string;
    updatedAt: string;
    claimedAt?: string;
    completedAt?: string;
    result?: Record<string, unknown>;
    error?: string;
}
export interface EditRequestPollResult {
    request?: CanvasEditRequest;
    timedOut: boolean;
    message: string;
}
export interface EditRequestQueueStatus {
    listenerActive: boolean;
    listenerLastSeenAt?: string;
    listenerActiveWindowMs: number;
    queuedCount: number;
    processingCount: number;
    latestRequest?: CanvasEditRequest;
    updatedAt: string;
}
export type RunType = 'generate' | 'edit_from_annotations' | 'insert_image_into_holder' | 'create_image_version' | 'failed';
export interface RunRecord {
    runId: string;
    type: RunType;
    model: 'codex-image-2.0' | 'external' | 'local-placeholder';
    input: Record<string, unknown>;
    annotationPlan?: AnnotationInstruction[];
    prompt?: string;
    output?: Record<string, unknown>;
    error?: string;
    createdAt: string;
}
export type CanvasPendingOperationType = 'create_image_holder' | 'insert_image_into_holder' | 'create_image_version';
export interface CanvasPendingOperation {
    id: string;
    type: CanvasPendingOperationType;
    payload: Record<string, unknown>;
    createdAt: string;
}
export interface VersionMetadata {
    shapeId: string;
    version: number;
    parentShapeId?: string;
    sourceRunId?: string;
    assetPath: string;
    createdAt: string;
}
export interface CanvasStatePayload {
    canvasId: string;
    metadata: CanvasMetadata;
    storagePath: string;
    snapshot?: unknown;
    selection: SelectionSnapshot;
    shapes: ShapeSummary[];
    pendingOperations?: CanvasPendingOperation[];
}
//# sourceMappingURL=types.d.ts.map
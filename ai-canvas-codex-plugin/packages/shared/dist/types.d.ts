export type AiCanvasRole = 'image_holder' | 'ai_image' | 'artboard' | 'annotation_text' | 'annotation_arrow' | 'annotation_mark' | 'version_group';
export type CanvasImageSource = 'codex_generation' | 'upload' | 'drag_drop' | 'paste' | 'url' | 'external_provider';
export type CanvasSkillCategory = 'social_media' | 'e_commerce' | 'branding' | 'marketing' | 'studio';
export type CanvasSkillEntrypoint = 'canvas_selection' | 'chat_skill_panel' | 'natural_language';
export type CanvasSkillCapability = 'image_generation' | 'image_editing' | 'text_generation' | 'layout' | 'background_removal' | 'upscale' | 'artboard_generation';
export type CanvasSkillRunStatus = 'queued' | 'planning' | 'requires_external_generation' | 'running' | 'applying_actions' | 'completed' | 'failed' | 'needs_clarification';
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
    skillRunId?: string;
    version?: number;
    parentShapeId?: string;
    assetPath?: string;
    assetUrl?: string;
    imageSource?: CanvasImageSource;
    importId?: string;
    usableAsSkillInput?: boolean;
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
export interface CanvasSkillRequest {
    requestId: string;
    runId: string;
    skillId: string;
    skillName: string;
    status: EditRequestStatus;
    briefStatus?: 'ready_to_generate' | 'needs_input';
    missingInputs?: string[];
    clarificationQuestions?: string[];
    canAutoGenerate: boolean;
    source: 'canvas_skill_button' | 'codex';
    canvasId: string;
    targetShapeId?: string;
    inputImagePath?: string;
    inputAssetPath?: string;
    userRequest?: string;
    brief?: Record<string, unknown>;
    codexInstruction: string;
    generationJob: CanvasGenerationJob;
    generationJobs?: CanvasGenerationJob[];
    overlayActions?: CanvasAction[];
    attempts: number;
    createdAt: string;
    updatedAt: string;
    claimedAt?: string;
    completedAt?: string;
    result?: Record<string, unknown>;
    error?: string;
}
export interface SkillRequestPollResult {
    request?: CanvasSkillRequest;
    timedOut: boolean;
    message: string;
}
export type RunType = 'generate' | 'import_image' | 'edit_from_annotations' | 'insert_image_into_holder' | 'create_image_version' | 'skill_run' | 'apply_canvas_actions' | 'failed';
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
export type CanvasPendingOperationType = 'create_image_holder' | 'import_image' | 'insert_image_into_holder' | 'create_image_version' | 'apply_canvas_actions';
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
export interface CanvasImageImport {
    importId: string;
    canvasId: string;
    source: CanvasImageSource;
    originalName?: string;
    originalUrl?: string;
    inputPath?: string;
    assetPath: string;
    assetUrl: string;
    width: number;
    height: number;
    mimeType?: string;
    createdShapeId?: string;
    createdAt: string;
}
export interface CanvasContext {
    canvasId: string;
    pageId: string;
    storagePath: string;
    selection: {
        selectedShapeIds: string[];
        primaryShape?: ShapeSummary;
        shapes: ShapeSummary[];
    };
    nearby: {
        texts: ShapeSummary[];
        images: ShapeSummary[];
        artboards: ShapeSummary[];
    };
    project: {
        brandName?: string;
        brandColors?: string[];
        preferredStyles?: string[];
        recentSkillRuns?: string[];
    };
}
export interface CanvasSkillManifest {
    id: string;
    name: string;
    category: CanvasSkillCategory;
    description: string;
    icon?: string;
    entrypoints: CanvasSkillEntrypoint[];
    inputRequirements: {
        requiresSelection?: boolean;
        acceptedRoles?: AiCanvasRole[];
        acceptedShapeTypes?: string[];
        minSelectionCount?: number;
        maxSelectionCount?: number;
        optionalTextPrompt?: boolean;
        requiredFields?: string[];
    };
    defaults: Record<string, unknown>;
    outputs: string[];
    capabilities: CanvasSkillCapability[];
    priority?: number;
    disabled?: boolean;
    disabledReason?: string;
}
export interface SkillRecommendation {
    skillId: string;
    name: string;
    category: CanvasSkillCategory;
    reason: string;
    confidence: number;
    missingInputs?: string[];
    disabledReason?: string;
}
export interface CanvasGenerationJob {
    jobId: string;
    prompt: string;
    aspectRatio: string;
    outputName: string;
    outputDir: string;
    placement: {
        x: number;
        y: number;
        w: number;
        h: number;
    };
    title: string;
    note?: string;
    brief?: Record<string, unknown>;
}
export interface CanvasSkillRun {
    runId: string;
    skillId: string;
    status: CanvasSkillRunStatus;
    canvasId: string;
    input: Record<string, unknown>;
    context: CanvasContext;
    generationJobs?: CanvasGenerationJob[];
    actions?: CanvasAction[];
    outputs?: Record<string, unknown>;
    error?: string;
    createdAt: string;
    updatedAt: string;
    completedAt?: string;
}
export type CanvasActionType = 'import_image' | 'create_artboard' | 'place_image' | 'place_text' | 'place_note' | 'create_group' | 'create_version' | 'save_snapshot';
export interface CanvasAction {
    id: string;
    type: CanvasActionType;
    payload: Record<string, unknown>;
}
export interface CanvasActionApplyResult {
    applied: boolean;
    actionCount: number;
    results: unknown[];
    failedActionId?: string;
    error?: string;
}
//# sourceMappingURL=types.d.ts.map
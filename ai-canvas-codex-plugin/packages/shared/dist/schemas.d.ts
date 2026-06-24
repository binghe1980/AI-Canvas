import { z } from 'zod';
export declare const boundsSchema: z.ZodObject<{
    x: z.ZodNumber;
    y: z.ZodNumber;
    w: z.ZodNumber;
    h: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    x: number;
    y: number;
    w: number;
    h: number;
}, {
    x: number;
    y: number;
    w: number;
    h: number;
}>;
export declare const canvasImageSourceSchema: z.ZodEnum<["codex_generation", "upload", "drag_drop", "paste", "url", "external_provider"]>;
export declare const canvasSkillCategorySchema: z.ZodEnum<["social_media", "e_commerce", "branding", "marketing", "studio"]>;
export declare const canvasActionSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodEnum<["import_image", "create_artboard", "place_image", "place_text", "place_note", "create_group", "create_version", "save_snapshot"]>;
    payload: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    type: "import_image" | "create_artboard" | "place_image" | "place_text" | "place_note" | "create_group" | "create_version" | "save_snapshot";
    id: string;
    payload: Record<string, unknown>;
}, {
    type: "import_image" | "create_artboard" | "place_image" | "place_text" | "place_note" | "create_group" | "create_version" | "save_snapshot";
    id: string;
    payload?: Record<string, unknown> | undefined;
}>;
export declare const editRequestStatusSchema: z.ZodEnum<["queued", "processing", "completed", "failed", "needs_clarification"]>;
export declare const openCanvasInputSchema: z.ZodObject<{
    workspaceRoot: z.ZodOptional<z.ZodString>;
    canvasId: z.ZodOptional<z.ZodString>;
    port: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    workspaceRoot?: string | undefined;
    canvasId?: string | undefined;
    port?: number | undefined;
}, {
    workspaceRoot?: string | undefined;
    canvasId?: string | undefined;
    port?: number | undefined;
}>;
export declare const createImageHolderInputSchema: z.ZodObject<{
    label: z.ZodDefault<z.ZodString>;
    aspectRatio: z.ZodDefault<z.ZodString>;
    x: z.ZodDefault<z.ZodNumber>;
    y: z.ZodDefault<z.ZodNumber>;
    w: z.ZodDefault<z.ZodNumber>;
    h: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    x: number;
    y: number;
    w: number;
    h: number;
    label: string;
    aspectRatio: string;
}, {
    x?: number | undefined;
    y?: number | undefined;
    w?: number | undefined;
    h?: number | undefined;
    label?: string | undefined;
    aspectRatio?: string | undefined;
}>;
export declare const insertImageIntoHolderInputSchema: z.ZodObject<{
    holderShapeId: z.ZodString;
    imagePath: z.ZodString;
    mode: z.ZodDefault<z.ZodEnum<["contain", "cover"]>>;
    title: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    holderShapeId: string;
    imagePath: string;
    mode: "contain" | "cover";
    title: string;
}, {
    holderShapeId: string;
    imagePath: string;
    mode?: "contain" | "cover" | undefined;
    title?: string | undefined;
}>;
export declare const importImageAssetInputSchema: z.ZodObject<{
    workspaceRoot: z.ZodOptional<z.ZodString>;
    canvasId: z.ZodOptional<z.ZodString>;
    port: z.ZodOptional<z.ZodNumber>;
} & {
    inputPath: z.ZodString;
    source: z.ZodDefault<z.ZodEnum<["codex_generation", "upload", "drag_drop", "paste", "url", "external_provider"]>>;
    title: z.ZodDefault<z.ZodString>;
    placement: z.ZodDefault<z.ZodEnum<["viewport_center", "selection_right", "absolute"]>>;
    x: z.ZodOptional<z.ZodNumber>;
    y: z.ZodOptional<z.ZodNumber>;
    w: z.ZodOptional<z.ZodNumber>;
    h: z.ZodOptional<z.ZodNumber>;
    selectAfterCreate: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    title: string;
    inputPath: string;
    source: "codex_generation" | "upload" | "drag_drop" | "paste" | "url" | "external_provider";
    placement: "viewport_center" | "selection_right" | "absolute";
    selectAfterCreate: boolean;
    x?: number | undefined;
    y?: number | undefined;
    w?: number | undefined;
    h?: number | undefined;
    workspaceRoot?: string | undefined;
    canvasId?: string | undefined;
    port?: number | undefined;
}, {
    inputPath: string;
    x?: number | undefined;
    y?: number | undefined;
    w?: number | undefined;
    h?: number | undefined;
    workspaceRoot?: string | undefined;
    canvasId?: string | undefined;
    port?: number | undefined;
    title?: string | undefined;
    source?: "codex_generation" | "upload" | "drag_drop" | "paste" | "url" | "external_provider" | undefined;
    placement?: "viewport_center" | "selection_right" | "absolute" | undefined;
    selectAfterCreate?: boolean | undefined;
}>;
export declare const importImageFromUrlInputSchema: z.ZodObject<{
    workspaceRoot: z.ZodOptional<z.ZodString>;
    canvasId: z.ZodOptional<z.ZodString>;
    port: z.ZodOptional<z.ZodNumber>;
} & {
    url: z.ZodString;
    title: z.ZodDefault<z.ZodString>;
    placement: z.ZodDefault<z.ZodEnum<["viewport_center", "selection_right", "absolute"]>>;
    x: z.ZodOptional<z.ZodNumber>;
    y: z.ZodOptional<z.ZodNumber>;
    w: z.ZodOptional<z.ZodNumber>;
    h: z.ZodOptional<z.ZodNumber>;
    selectAfterCreate: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    url: string;
    title: string;
    placement: "viewport_center" | "selection_right" | "absolute";
    selectAfterCreate: boolean;
    x?: number | undefined;
    y?: number | undefined;
    w?: number | undefined;
    h?: number | undefined;
    workspaceRoot?: string | undefined;
    canvasId?: string | undefined;
    port?: number | undefined;
}, {
    url: string;
    x?: number | undefined;
    y?: number | undefined;
    w?: number | undefined;
    h?: number | undefined;
    workspaceRoot?: string | undefined;
    canvasId?: string | undefined;
    port?: number | undefined;
    title?: string | undefined;
    placement?: "viewport_center" | "selection_right" | "absolute" | undefined;
    selectAfterCreate?: boolean | undefined;
}>;
export declare const collectAnnotationsInputSchema: z.ZodObject<{
    targetShapeId: z.ZodOptional<z.ZodString>;
    radius: z.ZodDefault<z.ZodNumber>;
    includeScreenshot: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    radius: number;
    includeScreenshot: boolean;
    targetShapeId?: string | undefined;
}, {
    targetShapeId?: string | undefined;
    radius?: number | undefined;
    includeScreenshot?: boolean | undefined;
}>;
export declare const createImageVersionInputSchema: z.ZodObject<{
    sourceShapeId: z.ZodString;
    imagePath: z.ZodString;
    placement: z.ZodDefault<z.ZodEnum<["right", "replace"]>>;
    title: z.ZodDefault<z.ZodString>;
    runId: z.ZodOptional<z.ZodString>;
    skillRunId: z.ZodOptional<z.ZodString>;
    x: z.ZodOptional<z.ZodNumber>;
    y: z.ZodOptional<z.ZodNumber>;
    w: z.ZodOptional<z.ZodNumber>;
    h: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    imagePath: string;
    title: string;
    placement: "right" | "replace";
    sourceShapeId: string;
    x?: number | undefined;
    y?: number | undefined;
    w?: number | undefined;
    h?: number | undefined;
    runId?: string | undefined;
    skillRunId?: string | undefined;
}, {
    imagePath: string;
    sourceShapeId: string;
    x?: number | undefined;
    y?: number | undefined;
    w?: number | undefined;
    h?: number | undefined;
    title?: string | undefined;
    placement?: "right" | "replace" | undefined;
    runId?: string | undefined;
    skillRunId?: string | undefined;
}>;
export declare const applyCanvasActionsInputSchema: z.ZodObject<{
    workspaceRoot: z.ZodOptional<z.ZodString>;
    canvasId: z.ZodOptional<z.ZodString>;
    port: z.ZodOptional<z.ZodNumber>;
} & {
    actions: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodEnum<["import_image", "create_artboard", "place_image", "place_text", "place_note", "create_group", "create_version", "save_snapshot"]>;
        payload: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        type: "import_image" | "create_artboard" | "place_image" | "place_text" | "place_note" | "create_group" | "create_version" | "save_snapshot";
        id: string;
        payload: Record<string, unknown>;
    }, {
        type: "import_image" | "create_artboard" | "place_image" | "place_text" | "place_note" | "create_group" | "create_version" | "save_snapshot";
        id: string;
        payload?: Record<string, unknown> | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    actions: {
        type: "import_image" | "create_artboard" | "place_image" | "place_text" | "place_note" | "create_group" | "create_version" | "save_snapshot";
        id: string;
        payload: Record<string, unknown>;
    }[];
    workspaceRoot?: string | undefined;
    canvasId?: string | undefined;
    port?: number | undefined;
}, {
    actions: {
        type: "import_image" | "create_artboard" | "place_image" | "place_text" | "place_note" | "create_group" | "create_version" | "save_snapshot";
        id: string;
        payload?: Record<string, unknown> | undefined;
    }[];
    workspaceRoot?: string | undefined;
    canvasId?: string | undefined;
    port?: number | undefined;
}>;
export declare const listCanvasSkillsInputSchema: z.ZodObject<{
    category: z.ZodOptional<z.ZodEnum<["social_media", "e_commerce", "branding", "marketing", "studio"]>>;
}, "strip", z.ZodTypeAny, {
    category?: "social_media" | "e_commerce" | "branding" | "marketing" | "studio" | undefined;
}, {
    category?: "social_media" | "e_commerce" | "branding" | "marketing" | "studio" | undefined;
}>;
export declare const recommendCanvasSkillsInputSchema: z.ZodObject<{
    workspaceRoot: z.ZodOptional<z.ZodString>;
    canvasId: z.ZodOptional<z.ZodString>;
    port: z.ZodOptional<z.ZodNumber>;
} & {
    userRequest: z.ZodOptional<z.ZodString>;
    maxResults: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    maxResults: number;
    workspaceRoot?: string | undefined;
    canvasId?: string | undefined;
    port?: number | undefined;
    userRequest?: string | undefined;
}, {
    workspaceRoot?: string | undefined;
    canvasId?: string | undefined;
    port?: number | undefined;
    userRequest?: string | undefined;
    maxResults?: number | undefined;
}>;
export declare const prepareSkillRunInputSchema: z.ZodObject<{
    workspaceRoot: z.ZodOptional<z.ZodString>;
    canvasId: z.ZodOptional<z.ZodString>;
    port: z.ZodOptional<z.ZodNumber>;
} & {
    skillId: z.ZodString;
    userRequest: z.ZodOptional<z.ZodString>;
    selectionMode: z.ZodDefault<z.ZodEnum<["current"]>>;
}, "strip", z.ZodTypeAny, {
    skillId: string;
    selectionMode: "current";
    workspaceRoot?: string | undefined;
    canvasId?: string | undefined;
    port?: number | undefined;
    userRequest?: string | undefined;
}, {
    skillId: string;
    workspaceRoot?: string | undefined;
    canvasId?: string | undefined;
    port?: number | undefined;
    userRequest?: string | undefined;
    selectionMode?: "current" | undefined;
}>;
export declare const runCanvasSkillInputSchema: z.ZodObject<{
    workspaceRoot: z.ZodOptional<z.ZodString>;
    canvasId: z.ZodOptional<z.ZodString>;
    port: z.ZodOptional<z.ZodNumber>;
} & {
    runId: z.ZodString;
    overrides: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    runId: string;
    workspaceRoot?: string | undefined;
    canvasId?: string | undefined;
    port?: number | undefined;
    overrides?: Record<string, unknown> | undefined;
}, {
    runId: string;
    workspaceRoot?: string | undefined;
    canvasId?: string | undefined;
    port?: number | undefined;
    overrides?: Record<string, unknown> | undefined;
}>;
export declare const getSkillRunInputSchema: z.ZodObject<{
    runId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    runId: string;
}, {
    runId: string;
}>;
export declare const submitSkillRequestInputSchema: z.ZodObject<{
    workspaceRoot: z.ZodOptional<z.ZodString>;
    canvasId: z.ZodOptional<z.ZodString>;
    port: z.ZodOptional<z.ZodNumber>;
} & {
    skillId: z.ZodString;
    userRequest: z.ZodOptional<z.ZodString>;
    brief: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    inputDataUrl: z.ZodOptional<z.ZodString>;
    inputTitle: z.ZodOptional<z.ZodString>;
    selectionMode: z.ZodDefault<z.ZodEnum<["current"]>>;
}, "strip", z.ZodTypeAny, {
    skillId: string;
    selectionMode: "current";
    workspaceRoot?: string | undefined;
    canvasId?: string | undefined;
    port?: number | undefined;
    userRequest?: string | undefined;
    brief?: Record<string, unknown> | undefined;
    inputDataUrl?: string | undefined;
    inputTitle?: string | undefined;
}, {
    skillId: string;
    workspaceRoot?: string | undefined;
    canvasId?: string | undefined;
    port?: number | undefined;
    userRequest?: string | undefined;
    selectionMode?: "current" | undefined;
    brief?: Record<string, unknown> | undefined;
    inputDataUrl?: string | undefined;
    inputTitle?: string | undefined;
}>;
export declare const watchSkillRequestsInputSchema: z.ZodObject<{
    workspaceRoot: z.ZodOptional<z.ZodString>;
    canvasId: z.ZodOptional<z.ZodString>;
    port: z.ZodOptional<z.ZodNumber>;
} & {
    waitMs: z.ZodDefault<z.ZodNumber>;
    claim: z.ZodDefault<z.ZodBoolean>;
    includeCompleted: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    waitMs: number;
    claim: boolean;
    includeCompleted: boolean;
    workspaceRoot?: string | undefined;
    canvasId?: string | undefined;
    port?: number | undefined;
}, {
    workspaceRoot?: string | undefined;
    canvasId?: string | undefined;
    port?: number | undefined;
    waitMs?: number | undefined;
    claim?: boolean | undefined;
    includeCompleted?: boolean | undefined;
}>;
export declare const getSkillRequestInputSchema: z.ZodObject<{
    requestId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    requestId: string;
}, {
    requestId: string;
}>;
export declare const updateSkillRequestInputSchema: z.ZodObject<{
    requestId: z.ZodString;
    status: z.ZodEnum<["queued", "processing", "completed", "failed", "needs_clarification"]>;
    error: z.ZodOptional<z.ZodString>;
    result: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    status: "queued" | "completed" | "failed" | "needs_clarification" | "processing";
    requestId: string;
    error?: string | undefined;
    result?: Record<string, unknown> | undefined;
}, {
    status: "queued" | "completed" | "failed" | "needs_clarification" | "processing";
    requestId: string;
    error?: string | undefined;
    result?: Record<string, unknown> | undefined;
}>;
export declare const prepareImageGenerationInputSchema: z.ZodObject<{
    workspaceRoot: z.ZodOptional<z.ZodString>;
    canvasId: z.ZodOptional<z.ZodString>;
    port: z.ZodOptional<z.ZodNumber>;
} & {
    request: z.ZodString;
    aspectRatio: z.ZodDefault<z.ZodString>;
    label: z.ZodDefault<z.ZodString>;
    intendedUse: z.ZodOptional<z.ZodString>;
    x: z.ZodDefault<z.ZodNumber>;
    y: z.ZodDefault<z.ZodNumber>;
    w: z.ZodOptional<z.ZodNumber>;
    h: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    x: number;
    y: number;
    label: string;
    aspectRatio: string;
    request: string;
    w?: number | undefined;
    h?: number | undefined;
    workspaceRoot?: string | undefined;
    canvasId?: string | undefined;
    port?: number | undefined;
    intendedUse?: string | undefined;
}, {
    request: string;
    x?: number | undefined;
    y?: number | undefined;
    w?: number | undefined;
    h?: number | undefined;
    workspaceRoot?: string | undefined;
    canvasId?: string | undefined;
    port?: number | undefined;
    label?: string | undefined;
    aspectRatio?: string | undefined;
    intendedUse?: string | undefined;
}>;
export declare const prepareAnnotationEditInputSchema: z.ZodObject<{
    workspaceRoot: z.ZodOptional<z.ZodString>;
    canvasId: z.ZodOptional<z.ZodString>;
    port: z.ZodOptional<z.ZodNumber>;
} & {
    targetShapeId: z.ZodOptional<z.ZodString>;
    userRequest: z.ZodOptional<z.ZodString>;
    radius: z.ZodDefault<z.ZodNumber>;
    includeScreenshot: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    radius: number;
    includeScreenshot: boolean;
    workspaceRoot?: string | undefined;
    canvasId?: string | undefined;
    port?: number | undefined;
    targetShapeId?: string | undefined;
    userRequest?: string | undefined;
}, {
    workspaceRoot?: string | undefined;
    canvasId?: string | undefined;
    port?: number | undefined;
    targetShapeId?: string | undefined;
    radius?: number | undefined;
    includeScreenshot?: boolean | undefined;
    userRequest?: string | undefined;
}>;
export declare const watchEditRequestsInputSchema: z.ZodObject<{
    workspaceRoot: z.ZodOptional<z.ZodString>;
    canvasId: z.ZodOptional<z.ZodString>;
    port: z.ZodOptional<z.ZodNumber>;
} & {
    waitMs: z.ZodDefault<z.ZodNumber>;
    claim: z.ZodDefault<z.ZodBoolean>;
    includeCompleted: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    waitMs: number;
    claim: boolean;
    includeCompleted: boolean;
    workspaceRoot?: string | undefined;
    canvasId?: string | undefined;
    port?: number | undefined;
}, {
    workspaceRoot?: string | undefined;
    canvasId?: string | undefined;
    port?: number | undefined;
    waitMs?: number | undefined;
    claim?: boolean | undefined;
    includeCompleted?: boolean | undefined;
}>;
export declare const getEditRequestInputSchema: z.ZodObject<{
    requestId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    requestId: string;
}, {
    requestId: string;
}>;
export declare const updateEditRequestInputSchema: z.ZodObject<{
    requestId: z.ZodString;
    status: z.ZodEnum<["queued", "processing", "completed", "failed", "needs_clarification"]>;
    error: z.ZodOptional<z.ZodString>;
    result: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    status: "queued" | "completed" | "failed" | "needs_clarification" | "processing";
    requestId: string;
    error?: string | undefined;
    result?: Record<string, unknown> | undefined;
}, {
    status: "queued" | "completed" | "failed" | "needs_clarification" | "processing";
    requestId: string;
    error?: string | undefined;
    result?: Record<string, unknown> | undefined;
}>;
export declare const saveSnapshotInputSchema: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
export type OpenCanvasInput = z.infer<typeof openCanvasInputSchema>;
export type CreateImageHolderInput = z.infer<typeof createImageHolderInputSchema>;
export type InsertImageIntoHolderInput = z.infer<typeof insertImageIntoHolderInputSchema>;
export type ImportImageAssetInput = z.infer<typeof importImageAssetInputSchema>;
export type ImportImageFromUrlInput = z.infer<typeof importImageFromUrlInputSchema>;
export type CollectAnnotationsInput = z.infer<typeof collectAnnotationsInputSchema>;
export type CreateImageVersionInput = z.infer<typeof createImageVersionInputSchema>;
export type ApplyCanvasActionsInput = z.infer<typeof applyCanvasActionsInputSchema>;
export type ListCanvasSkillsInput = z.infer<typeof listCanvasSkillsInputSchema>;
export type RecommendCanvasSkillsInput = z.infer<typeof recommendCanvasSkillsInputSchema>;
export type PrepareSkillRunInput = z.infer<typeof prepareSkillRunInputSchema>;
export type RunCanvasSkillInput = z.infer<typeof runCanvasSkillInputSchema>;
export type GetSkillRunInput = z.infer<typeof getSkillRunInputSchema>;
export type SubmitSkillRequestInput = z.infer<typeof submitSkillRequestInputSchema>;
export type WatchSkillRequestsInput = z.infer<typeof watchSkillRequestsInputSchema>;
export type GetSkillRequestInput = z.infer<typeof getSkillRequestInputSchema>;
export type UpdateSkillRequestInput = z.infer<typeof updateSkillRequestInputSchema>;
export type PrepareImageGenerationInput = z.infer<typeof prepareImageGenerationInputSchema>;
export type PrepareAnnotationEditInput = z.infer<typeof prepareAnnotationEditInputSchema>;
export type WatchEditRequestsInput = z.infer<typeof watchEditRequestsInputSchema>;
export type GetEditRequestInput = z.infer<typeof getEditRequestInputSchema>;
export type UpdateEditRequestInput = z.infer<typeof updateEditRequestInputSchema>;
//# sourceMappingURL=schemas.d.ts.map
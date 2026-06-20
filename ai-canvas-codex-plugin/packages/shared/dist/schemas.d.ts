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
}, "strip", z.ZodTypeAny, {
    imagePath: string;
    title: string;
    sourceShapeId: string;
    placement: "right" | "replace";
    runId?: string | undefined;
}, {
    imagePath: string;
    sourceShapeId: string;
    title?: string | undefined;
    placement?: "right" | "replace" | undefined;
    runId?: string | undefined;
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
export declare const editRequestStatusSchema: z.ZodEnum<["queued", "processing", "completed", "failed", "needs_clarification"]>;
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
    status: "queued" | "processing" | "completed" | "failed" | "needs_clarification";
    requestId: string;
    error?: string | undefined;
    result?: Record<string, unknown> | undefined;
}, {
    status: "queued" | "processing" | "completed" | "failed" | "needs_clarification";
    requestId: string;
    error?: string | undefined;
    result?: Record<string, unknown> | undefined;
}>;
export declare const saveSnapshotInputSchema: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
export type OpenCanvasInput = z.infer<typeof openCanvasInputSchema>;
export type CreateImageHolderInput = z.infer<typeof createImageHolderInputSchema>;
export type InsertImageIntoHolderInput = z.infer<typeof insertImageIntoHolderInputSchema>;
export type CollectAnnotationsInput = z.infer<typeof collectAnnotationsInputSchema>;
export type CreateImageVersionInput = z.infer<typeof createImageVersionInputSchema>;
export type PrepareImageGenerationInput = z.infer<typeof prepareImageGenerationInputSchema>;
export type PrepareAnnotationEditInput = z.infer<typeof prepareAnnotationEditInputSchema>;
export type WatchEditRequestsInput = z.infer<typeof watchEditRequestsInputSchema>;
export type GetEditRequestInput = z.infer<typeof getEditRequestInputSchema>;
export type UpdateEditRequestInput = z.infer<typeof updateEditRequestInputSchema>;
//# sourceMappingURL=schemas.d.ts.map
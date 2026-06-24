import { z } from 'zod';
export const boundsSchema = z.object({
    x: z.number(),
    y: z.number(),
    w: z.number().positive(),
    h: z.number().positive()
});
export const canvasImageSourceSchema = z.enum([
    'codex_generation',
    'upload',
    'drag_drop',
    'paste',
    'url',
    'external_provider'
]);
export const canvasSkillCategorySchema = z.enum([
    'social_media',
    'e_commerce',
    'branding',
    'marketing',
    'studio'
]);
export const canvasActionSchema = z.object({
    id: z.string(),
    type: z.enum([
        'import_image',
        'create_artboard',
        'place_image',
        'place_text',
        'place_note',
        'create_group',
        'create_version',
        'save_snapshot'
    ]),
    payload: z.record(z.unknown()).default({})
});
export const editRequestStatusSchema = z.enum([
    'queued',
    'processing',
    'completed',
    'failed',
    'needs_clarification'
]);
export const openCanvasInputSchema = z.object({
    workspaceRoot: z.string().optional(),
    canvasId: z.string().optional(),
    port: z.number().int().positive().optional()
});
export const createImageHolderInputSchema = z.object({
    label: z.string().default('AI 图片'),
    aspectRatio: z.string().default('5:7'),
    x: z.number().default(100),
    y: z.number().default(100),
    w: z.number().positive().default(403),
    h: z.number().positive().default(567)
});
export const insertImageIntoHolderInputSchema = z.object({
    holderShapeId: z.string(),
    imagePath: z.string(),
    mode: z.enum(['contain', 'cover']).default('contain'),
    title: z.string().default('AI 图片')
});
export const importImageAssetInputSchema = openCanvasInputSchema.extend({
    inputPath: z.string(),
    source: canvasImageSourceSchema.default('upload'),
    title: z.string().default('外部导入图片'),
    placement: z.enum(['viewport_center', 'selection_right', 'absolute']).default('selection_right'),
    x: z.number().optional(),
    y: z.number().optional(),
    w: z.number().positive().optional(),
    h: z.number().positive().optional(),
    selectAfterCreate: z.boolean().default(true)
});
export const importImageFromUrlInputSchema = openCanvasInputSchema.extend({
    url: z.string().url(),
    title: z.string().default('URL 导入图片'),
    placement: z.enum(['viewport_center', 'selection_right', 'absolute']).default('selection_right'),
    x: z.number().optional(),
    y: z.number().optional(),
    w: z.number().positive().optional(),
    h: z.number().positive().optional(),
    selectAfterCreate: z.boolean().default(true)
});
export const collectAnnotationsInputSchema = z.object({
    targetShapeId: z.string().optional(),
    radius: z.number().positive().default(300),
    includeScreenshot: z.boolean().default(true)
});
export const createImageVersionInputSchema = z.object({
    sourceShapeId: z.string(),
    imagePath: z.string(),
    placement: z.enum(['right', 'replace']).default('right'),
    title: z.string().default('AI 图片 v2'),
    runId: z.string().optional(),
    skillRunId: z.string().optional(),
    x: z.number().optional(),
    y: z.number().optional(),
    w: z.number().positive().optional(),
    h: z.number().positive().optional()
});
export const applyCanvasActionsInputSchema = openCanvasInputSchema.extend({
    actions: z.array(canvasActionSchema)
});
export const listCanvasSkillsInputSchema = z.object({
    category: canvasSkillCategorySchema.optional()
});
export const recommendCanvasSkillsInputSchema = openCanvasInputSchema.extend({
    userRequest: z.string().optional(),
    maxResults: z.number().int().positive().max(10).default(5)
});
export const prepareSkillRunInputSchema = openCanvasInputSchema.extend({
    skillId: z.string(),
    userRequest: z.string().optional(),
    selectionMode: z.enum(['current']).default('current')
});
export const runCanvasSkillInputSchema = openCanvasInputSchema.extend({
    runId: z.string(),
    overrides: z.record(z.unknown()).optional()
});
export const getSkillRunInputSchema = z.object({
    runId: z.string()
});
export const submitSkillRequestInputSchema = openCanvasInputSchema.extend({
    skillId: z.string(),
    userRequest: z.string().optional(),
    brief: z.record(z.unknown()).optional(),
    inputDataUrl: z.string().optional(),
    inputTitle: z.string().optional(),
    selectionMode: z.enum(['current']).default('current')
});
export const watchSkillRequestsInputSchema = openCanvasInputSchema.extend({
    waitMs: z.number().int().min(0).max(55_000).default(30_000),
    claim: z.boolean().default(true),
    includeCompleted: z.boolean().default(false)
});
export const getSkillRequestInputSchema = z.object({
    requestId: z.string()
});
export const updateSkillRequestInputSchema = z.object({
    requestId: z.string(),
    status: editRequestStatusSchema,
    error: z.string().optional(),
    result: z.record(z.unknown()).optional()
});
export const prepareImageGenerationInputSchema = openCanvasInputSchema.extend({
    request: z.string().describe('The user natural-language image request.'),
    aspectRatio: z.string().default('5:7'),
    label: z.string().default('AI 图片'),
    intendedUse: z.string().optional(),
    x: z.number().default(120),
    y: z.number().default(100),
    w: z.number().positive().optional(),
    h: z.number().positive().optional()
});
export const prepareAnnotationEditInputSchema = openCanvasInputSchema.extend({
    targetShapeId: z.string().optional(),
    userRequest: z.string().optional(),
    radius: z.number().positive().default(300),
    includeScreenshot: z.boolean().default(true)
});
export const watchEditRequestsInputSchema = openCanvasInputSchema.extend({
    waitMs: z.number().int().min(0).max(55_000).default(30_000),
    claim: z.boolean().default(true),
    includeCompleted: z.boolean().default(false)
});
export const getEditRequestInputSchema = z.object({
    requestId: z.string()
});
export const updateEditRequestInputSchema = z.object({
    requestId: z.string(),
    status: editRequestStatusSchema,
    error: z.string().optional(),
    result: z.record(z.unknown()).optional()
});
export const saveSnapshotInputSchema = z.object({});

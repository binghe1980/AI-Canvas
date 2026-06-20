import { describe, expect, it } from 'vitest';
import { parseAnnotations } from './parseAnnotations.js';
function state(overrides = {}) {
    const base = {
        canvasId: 'canvas_test',
        storagePath: '/tmp/canvas',
        metadata: {
            canvasId: 'canvas_test',
            name: 'Test',
            createdAt: '2026-06-20T00:00:00.000Z',
            updatedAt: '2026-06-20T00:00:00.000Z',
            workspaceRoot: '/tmp',
            activePageId: 'page_main',
            appVersion: '0.1.0'
        },
        selection: {
            canvasId: 'canvas_test',
            pageId: 'page_main',
            selectedShapeIds: [],
            shapes: []
        },
        shapes: [
            {
                id: 'shape:image_1',
                type: 'image',
                role: 'ai_image',
                bounds: { x: 100, y: 100, w: 400, h: 500 },
                assetPath: 'assets/images/a.png'
            }
        ]
    };
    return { ...base, ...overrides };
}
describe('parseAnnotations', () => {
    it('turns arrow plus nearby text into a relative edit instruction', () => {
        const result = parseAnnotations({
            radius: 300,
            state: state({
                shapes: [
                    {
                        id: 'shape:image_1',
                        type: 'image',
                        role: 'ai_image',
                        bounds: { x: 100, y: 100, w: 400, h: 500 },
                        assetPath: 'assets/images/a.png'
                    },
                    {
                        id: 'shape:arrow_1',
                        type: 'arrow',
                        bounds: { x: 80, y: 260, w: 170, h: 80 },
                        arrowStart: { x: 80, y: 260 },
                        arrowEnd: { x: 240, y: 330 }
                    },
                    {
                        id: 'shape:text_1',
                        type: 'text',
                        bounds: { x: 40, y: 220, w: 120, h: 40 },
                        text: '这里用白汤'
                    }
                ]
            })
        });
        expect(result.needsClarification).toBe(false);
        expect(result.annotationPlan).toHaveLength(1);
        expect(result.annotationPlan[0].instruction).toBe('这里用白汤');
        expect(result.annotationPlan[0].region.x).toBeGreaterThan(0.2);
        expect(result.annotationPlan[0].region.y).toBeGreaterThan(0.3);
    });
    it('asks for clarification when there are multiple images and no selected target', () => {
        const result = parseAnnotations({
            radius: 300,
            state: state({
                shapes: [
                    {
                        id: 'shape:image_1',
                        type: 'image',
                        role: 'ai_image',
                        bounds: { x: 100, y: 100, w: 400, h: 500 }
                    },
                    {
                        id: 'shape:image_2',
                        type: 'image',
                        role: 'ai_image',
                        bounds: { x: 600, y: 100, w: 400, h: 500 }
                    }
                ]
            })
        });
        expect(result.needsClarification).toBe(true);
        expect(result.clarificationReason).toContain('Multiple');
    });
});

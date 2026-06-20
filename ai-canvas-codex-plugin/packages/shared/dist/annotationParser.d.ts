import type { AnnotationInstruction, AnnotationPlanResult, CanvasStatePayload } from './types.js';
export type ParseAnnotationsInput = {
    state: CanvasStatePayload;
    targetShapeId?: string;
    radius: number;
};
export declare function parseAnnotations(input: ParseAnnotationsInput): AnnotationPlanResult;
export declare function formatAnnotationInstruction(annotation: AnnotationInstruction, index: number): string;
export declare function buildAnnotationEditPrompt(input: {
    userRequest?: string;
    annotations: AnnotationInstruction[];
}): string;
//# sourceMappingURL=annotationParser.d.ts.map
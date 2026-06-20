import { boundsToRelativeRegion, center, distance, expanded, intersection, intersects, pointToRelativeRegion } from './geometry.js';
function isAiImage(shape) {
    return shape.role === 'ai_image' || shape.type === 'image';
}
function isAnnotationText(shape) {
    return Boolean(shape.text?.trim()) && shape.role !== 'image_holder' && shape.role !== 'ai_image';
}
function isArrow(shape) {
    return shape.type === 'arrow' || shape.role === 'annotation_arrow';
}
function isMark(shape) {
    return ((shape.type === 'geo' || shape.type === 'draw') &&
        shape.role !== 'image_holder' &&
        shape.role !== 'ai_image');
}
function nearestText(point, texts, maxDistance) {
    return texts
        .map((text) => ({ text, distance: distance(point, center(text.bounds)) }))
        .filter((candidate) => candidate.distance <= maxDistance)
        .sort((a, b) => a.distance - b.distance)[0]?.text;
}
function makeInstruction(input) {
    const text = input.instruction?.trim() || '使用该标记区域作为视觉参考进行自然修改';
    return {
        id: input.id,
        instruction: text,
        region: input.region,
        sourceShapeIds: [...new Set(input.shapeIds)],
        confidence: input.instruction && input.instruction.trim().length >= 3
            ? input.confidence
            : Math.min(input.confidence, 0.58),
        kind: input.kind
    };
}
function chooseTarget(state, targetShapeId) {
    const images = state.shapes.filter(isAiImage);
    if (targetShapeId) {
        return {
            target: state.shapes.find((shape) => shape.id === targetShapeId),
            images,
            reason: undefined
        };
    }
    const selectedImage = state.selection.shapes.find(isAiImage);
    if (selectedImage)
        return { target: selectedImage, images, reason: undefined };
    if (images.length === 1)
        return { target: images[0], images, reason: undefined };
    return {
        target: undefined,
        images,
        reason: images.length === 0
            ? 'No AI image exists on the current page.'
            : 'Multiple AI images exist and no target image is selected.'
    };
}
export function parseAnnotations(input) {
    const { target, images, reason } = chooseTarget(input.state, input.targetShapeId);
    if (!target) {
        return {
            targetShapeId: input.targetShapeId ?? '',
            annotationPlan: [],
            needsClarification: true,
            clarificationReason: reason
        };
    }
    const targetBounds = target.bounds;
    const texts = input.state.shapes.filter(isAnnotationText);
    const nearbyBounds = expanded(targetBounds, input.radius);
    const plan = [];
    for (const arrow of input.state.shapes.filter(isArrow)) {
        const arrowPoint = arrow.arrowEnd ?? center(arrow.bounds);
        if (!intersects(arrow.bounds, nearbyBounds) &&
            distance(arrowPoint, center(targetBounds)) > input.radius) {
            continue;
        }
        const textAnchor = arrow.arrowStart ?? center(arrow.bounds);
        const text = nearestText(textAnchor, texts, 240) ?? nearestText(arrowPoint, texts, 240);
        plan.push(makeInstruction({
            id: `ann_${plan.length + 1}`,
            instruction: arrow.text || text?.text,
            region: pointToRelativeRegion(arrowPoint, targetBounds),
            shapeIds: [arrow.id, text?.id].filter(Boolean),
            confidence: text ? 0.86 : 0.58,
            kind: 'arrow_text'
        }));
    }
    for (const mark of input.state.shapes.filter(isMark)) {
        const overlap = intersection(mark.bounds, targetBounds);
        if (!overlap)
            continue;
        const text = nearestText(center(mark.bounds), texts, 220);
        const geoKind = mark.type === 'draw'
            ? 'draw_mark'
            : mark.bounds.w / Math.max(mark.bounds.h, 1) > 1.4
                ? 'box_text'
                : 'circle_text';
        plan.push(makeInstruction({
            id: `ann_${plan.length + 1}`,
            instruction: mark.text || text?.text,
            region: boundsToRelativeRegion(overlap, targetBounds),
            shapeIds: [mark.id, text?.id].filter(Boolean),
            confidence: text ? 0.76 : 0.48,
            kind: geoKind
        }));
    }
    if (plan.length === 0) {
        const nearbyText = texts
            .filter((text) => intersects(text.bounds, nearbyBounds))
            .sort((a, b) => distance(center(a.bounds), center(targetBounds)) -
            distance(center(b.bounds), center(targetBounds)))[0];
        if (nearbyText) {
            plan.push(makeInstruction({
                id: 'ann_1',
                instruction: nearbyText.text,
                region: { x: 0, y: 0, w: 1, h: 1 },
                shapeIds: [nearbyText.id],
                confidence: 0.42,
                kind: 'text_near_image'
            }));
        }
    }
    const lowConfidence = plan.some((item) => item.confidence < 0.55);
    const multipleTargets = images.length > 1 && !input.targetShapeId && !input.state.selection.shapes.some(isAiImage);
    const noAnnotations = plan.length === 0;
    return {
        targetShapeId: target.id,
        targetImagePath: target.assetPath,
        annotationPlan: plan,
        needsClarification: multipleTargets || lowConfidence || noAnnotations,
        clarificationReason: multipleTargets
            ? 'Multiple AI images exist and no image is selected.'
            : noAnnotations
                ? 'No nearby annotations were found.'
                : lowConfidence
                    ? 'One or more annotations are low confidence.'
                    : undefined
    };
}
export function formatAnnotationInstruction(annotation, index) {
    const region = annotation.region;
    return `${index + 1}. 在图片相对区域 x=${region.x.toFixed(2)}, y=${region.y.toFixed(2)}, w=${region.w.toFixed(2)}, h=${region.h.toFixed(2)}：${annotation.instruction}`;
}
export function buildAnnotationEditPrompt(input) {
    const annotationList = input.annotations.length
        ? input.annotations.map(formatAnnotationInstruction).join('\n')
        : '没有可靠的结构化标注。请优先保持原图不变，等待用户补充说明。';
    return [
        `基于输入图片进行编辑。保持整体构图、主体位置、光影风格、画面质感和品牌视觉风格不变。`,
        input.userRequest ? `用户补充要求：${input.userRequest}` : undefined,
        ``,
        `请根据以下画布标注进行修改：`,
        annotationList,
        ``,
        `不要改变：`,
        `- 未标注区域。`,
        `- 品牌名和主要标题，除非用户明确要求。`,
        `- 原图整体比例、风格和主体识别度。`,
        ``,
        `输出要求：与原图相同比例；修改自然；如果某条标注意图不明确，优先保持原样。`
    ]
        .filter((line) => line !== undefined)
        .join('\n');
}

export function clamp(value, min = 0, max = 1) {
    return Math.max(min, Math.min(max, value));
}
export function center(bounds) {
    return {
        x: bounds.x + bounds.w / 2,
        y: bounds.y + bounds.h / 2
    };
}
export function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}
export function expanded(bounds, amount) {
    return {
        x: bounds.x - amount,
        y: bounds.y - amount,
        w: bounds.w + amount * 2,
        h: bounds.h + amount * 2
    };
}
export function intersects(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
export function intersection(a, b) {
    const x = Math.max(a.x, b.x);
    const y = Math.max(a.y, b.y);
    const right = Math.min(a.x + a.w, b.x + b.w);
    const bottom = Math.min(a.y + a.h, b.y + b.h);
    if (right <= x || bottom <= y)
        return undefined;
    return { x, y, w: right - x, h: bottom - y };
}
export function pointToRelativeRegion(point, image, w = 0.14, h = 0.12) {
    const rx = clamp((point.x - image.x) / image.w);
    const ry = clamp((point.y - image.y) / image.h);
    return {
        x: clamp(rx - w / 2),
        y: clamp(ry - h / 2),
        w: clamp(w),
        h: clamp(h)
    };
}
export function boundsToRelativeRegion(bounds, image) {
    return {
        x: clamp((bounds.x - image.x) / image.w),
        y: clamp((bounds.y - image.y) / image.h),
        w: clamp(bounds.w / image.w),
        h: clamp(bounds.h / image.h)
    };
}

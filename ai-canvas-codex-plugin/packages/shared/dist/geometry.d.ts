import type { Bounds, Point } from './types.js';
export declare function clamp(value: number, min?: number, max?: number): number;
export declare function center(bounds: Bounds): Point;
export declare function distance(a: Point, b: Point): number;
export declare function expanded(bounds: Bounds, amount: number): Bounds;
export declare function intersects(a: Bounds, b: Bounds): boolean;
export declare function intersection(a: Bounds, b: Bounds): Bounds | undefined;
export declare function pointToRelativeRegion(point: Point, image: Bounds, w?: number, h?: number): Bounds;
export declare function boundsToRelativeRegion(bounds: Bounds, image: Bounds): Bounds;
//# sourceMappingURL=geometry.d.ts.map
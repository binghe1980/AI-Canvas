import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export async function assertReadableFile(filePath) {
    const absolute = path.resolve(filePath);
    await access(absolute);
    return absolute;
}
export function findPluginRoot(fromUrl) {
    let current = path.dirname(fileURLToPath(fromUrl));
    for (let index = 0; index < 8; index += 1) {
        if (path.basename(current) === 'ai-canvas-codex-plugin')
            return current;
        const parent = path.dirname(current);
        if (parent === current)
            break;
        current = parent;
    }
    return path.resolve(path.dirname(fileURLToPath(fromUrl)), '../../..');
}

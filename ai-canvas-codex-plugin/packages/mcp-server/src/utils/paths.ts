import { access } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export async function assertReadableFile(filePath: string) {
  const absolute = path.resolve(filePath)
  await access(absolute)
  return absolute
}

export function findPluginRoot(fromUrl: string) {
  let current = path.dirname(fileURLToPath(fromUrl))
  for (let index = 0; index < 12; index += 1) {
    const packageJsonPath = path.join(current, 'package.json')
    if (existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(String(readFileSync(packageJsonPath)))
        if (packageJson.name === 'ai-canvas-codex-plugin') return current
      } catch {
        // Keep walking.
      }
    }
    const parent = path.dirname(current)
    if (parent === current) break
    current = parent
  }
  return path.resolve(path.dirname(fileURLToPath(fromUrl)), '../../..')
}

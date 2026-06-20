#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = path.dirname(pluginRoot)
const failures = []

function readJson(relativePath, root = pluginRoot) {
  const target = path.join(root, relativePath)
  if (!existsSync(target)) {
    failures.push(`Missing file: ${relativePath}`)
    return undefined
  }
  try {
    return JSON.parse(readFileSync(target, 'utf8'))
  } catch (error) {
    failures.push(`Invalid JSON in ${relativePath}: ${error.message}`)
    return undefined
  }
}

function requireString(value, label) {
  if (typeof value !== 'string' || !value.trim()) failures.push(`Missing string: ${label}`)
}

function requireArray(value, label) {
  if (!Array.isArray(value) || value.length === 0) failures.push(`Missing array: ${label}`)
}

function requirePath(relativePath, label, root = pluginRoot) {
  if (!existsSync(path.join(root, relativePath))) failures.push(`Missing ${label}: ${relativePath}`)
}

const manifest = readJson('.codex-plugin/plugin.json')
if (manifest) {
  requireString(manifest.name, 'plugin.name')
  requireString(manifest.version, 'plugin.version')
  requireString(manifest.description, 'plugin.description')
  requireString(manifest.author?.name, 'plugin.author.name')
  requireString(manifest.license, 'plugin.license')
  requirePath(manifest.skills?.replace(/^\.\//, '') ?? 'skills', 'skills directory')
  requirePath(manifest.mcpServers?.replace(/^\.\//, '') ?? '.mcp.json', 'MCP config')
  requireString(manifest.interface?.displayName, 'interface.displayName')
  requireString(manifest.interface?.shortDescription, 'interface.shortDescription')
  requireString(manifest.interface?.longDescription, 'interface.longDescription')
  requireString(manifest.interface?.developerName, 'interface.developerName')
  requireString(manifest.interface?.category, 'interface.category')
  requireArray(manifest.interface?.capabilities, 'interface.capabilities')
  requireArray(manifest.interface?.defaultPrompt, 'interface.defaultPrompt')
}

const mcpConfig = readJson('.mcp.json')
if (mcpConfig && !mcpConfig.mcpServers?.['ai-canvas']) {
  failures.push('Missing MCP server entry: ai-canvas')
}

const marketplace = readJson('.agents/plugins/marketplace.json', repositoryRoot)
if (marketplace) {
  requireString(marketplace.name, 'marketplace.name')
  const entry = marketplace.plugins?.find((plugin) => plugin.name === 'ai-canvas-codex-plugin')
  if (!entry) {
    failures.push('Marketplace does not list ai-canvas-codex-plugin')
  } else {
    requireString(entry.source?.path, 'marketplace.plugins[].source.path')
    if (entry.source?.path !== './ai-canvas-codex-plugin') {
      failures.push('Marketplace source path must be ./ai-canvas-codex-plugin')
    }
    requireString(entry.policy?.installation, 'marketplace.plugins[].policy.installation')
    requireString(entry.policy?.authentication, 'marketplace.plugins[].policy.authentication')
    requireString(entry.category, 'marketplace.plugins[].category')
  }
}

for (const relativePath of ['README.md', 'INSTALL.md', 'LICENSE']) {
  requirePath(relativePath, relativePath)
}
requirePath('README.md', 'repository README', repositoryRoot)
requirePath('LICENSE', 'repository LICENSE', repositoryRoot)

for (const relativePath of ['README.md', 'INSTALL.md', '.codex-plugin/plugin.json']) {
  const target = path.join(pluginRoot, relativePath)
  if (existsSync(target) && readFileSync(target, 'utf8').includes('[TODO:')) {
    failures.push(`TODO placeholder remains in ${relativePath}`)
  }
}

if (failures.length) {
  console.error('AI Canvas plugin validation failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('AI Canvas plugin validation passed.')

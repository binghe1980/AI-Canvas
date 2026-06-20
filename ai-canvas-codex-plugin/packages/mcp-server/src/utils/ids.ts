export function createRunId(prefix = 'run') {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
  const random = Math.random().toString(36).slice(2, 7)
  return `${prefix}_${stamp}_${random}`
}

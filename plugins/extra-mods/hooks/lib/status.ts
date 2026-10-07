// The status line's arithmetic, ported from statusline-command.py. Pure; the
// drawing and the data gathering are in register.tsx.

export const STATUS_GREEN = '#22c55e'
export const STATUS_YELLOW = '#eab308'
export const STATUS_RED = '#ef4444'
export const STATUS_CYAN = '#22d3ee'
export const BAR_WIDTH = 10

// Claude Code's main-thread prompt cache lives for an hour on a subscription.
export const CACHE_TTL_MS = 60 * 60 * 1000

export const colorFor = (percent: number): string =>
  percent >= 90 ? STATUS_RED : percent >= 70 ? STATUS_YELLOW : STATUS_GREEN

export const fmtTokens = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1000) return `${Math.round(n / 1000)}k`
  return String(n)
}

// Short countdown: 45s, 12m, 4h38m, 5d18h.
export const fmtDuration = (ms: number): string => {
  const secs = Math.max(0, Math.floor(ms / 1000))
  if (secs < 60) return `${secs}s`
  const m = Math.floor(secs / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h${String(m % 60).padStart(2, '0')}m`
  return `${Math.floor(h / 24)}d${String(h % 24).padStart(2, '0')}h`
}

// How many of the bar's cells are filled at `percent`.
export const barFill = (percent: number): number =>
  Math.floor((Math.min(Math.max(percent, 0), 100) * BAR_WIDTH) / 100)

// "ok" while the last response is younger than the cache, "over" after;
// null before the first response, when there is no cache to speak of.
export const cacheState = (lastResponseAt: number | null, now: number): 'ok' | 'over' | null =>
  lastResponseAt === null ? null : now - lastResponseAt < CACHE_TTL_MS ? 'ok' : 'over'

export const LIMIT_LABELS: Record<string, string> = { five_hour: '5h', seven_day: '7d' }

// Detail levels, most detailed first: bars and reset times, then no bars,
// then no reset times. The widest that fits `columns` wins.
export type Detail = 0 | 1 | 2

export const statsWidth = (
  ctxText: string,
  limits: readonly { label: string; percentText: string; resetText: string }[],
  cacheText: string,
  detail: Detail,
): number => {
  const bar = detail === 0 ? BAR_WIDTH + 1 : 0
  const sep = 5
  let width = 4 + bar + ctxText.length
  for (const l of limits) width += sep + l.label.length + 1 + bar + l.percentText.length + (detail < 2 ? l.resetText.length : 0)
  if (cacheText !== '') width += sep + cacheText.length
  return width
}

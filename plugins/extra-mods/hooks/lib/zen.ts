// Zen mode's look and arithmetic. Pure; the hooks are in register.tsx.

import type { StepStatus, ZenColors, ZenStyle, ZenTask, ZenTheme } from '../../types'
import { mix } from './palette'

export const ZEN_THEMES: readonly ZenTheme[] = ['blue', 'dark', 'light', 'green', 'rainbow', 'custom']

export const ZEN_STYLES: readonly ZenStyle[] = ['prism', 'classic']

export const RAINBOW = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7', '#ec4899']

const PRESETS: Record<Exclude<ZenTheme, 'custom'>, ZenColors> = {
  blue: { bar: '#3b82f6', text: '#bfdbfe', border: '#3b82f6' },
  dark: { bar: '#e5e7eb', text: '#d1d5db', border: '#6b7280' },
  // Its text is the theme's own, readable on a dark terminal and a light one.
  light: { bar: '#93c5fd', text: 'text', border: '#cbd5e1' },
  green: { bar: '#22c55e', text: '#bbf7d0', border: '#16a34a' },
  rainbow: { bar: '#ef4444', text: '#f9a8d4', border: '#ec4899' },
}

export const ZEN_TOOL_NAME = 'zen_progress'

export const ZEN_PROMPT = [
  'Zen mode is on: the user sees only your text messages, not your tool calls or their output.',
  'They follow your work on a progress band fed by the zen_progress tool (mcp__extra-mods__zen_progress).',
  'Before you start, call it with your plan as a list of short steps. Call it again with the whole list each time a step starts or finishes,',
  'so exactly one step is in_progress while you work and every step is completed when you are done.',
  'Before acting, say in a sentence what you are about to do and why.',
].join(' ')

export const ZEN_TOOL_DESCRIPTION =
  'Updates the Zen mode progress band the user watches. Send your whole plan each call: every step with its status ' +
  '(pending, in_progress or completed). Call it when you start a task and whenever a step starts or finishes.'

export const ZEN_TOOL_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Optional short name for the whole task.' },
    steps: {
      type: 'array',
      description: 'The full plan, in order.',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'The step, in a few words.' },
          status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] },
        },
        required: ['text', 'status'],
      },
    },
  },
  required: ['steps'],
}

export const colorsFor = (theme: ZenTheme, custom: ZenColors): ZenColors =>
  theme === 'custom' ? custom : PRESETS[theme]

export const percentOf = (t: ZenTask): number => {
  if (t.doneAt !== null) return 100
  if (t.steps.length === 0) return 0
  const done = t.steps.filter(s => s.status === 'completed').length
  return Math.round((done / t.steps.length) * 100)
}

const STATUSES: readonly StepStatus[] = ['pending', 'in_progress', 'completed']
export const asStatus = (s: unknown): StepStatus =>
  STATUSES.includes(s as StepStatus) ? (s as StepStatus) : 'pending'

export const elapsed = (ms: number): string => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
}

export const stepLabel = (t: ZenTask): string => {
  if (t.doneAt !== null) return 'Done'
  if (t.steps.length === 0) return 'Working…'
  const current = t.steps.findIndex(s => s.status === 'in_progress')
  const done = t.steps.filter(s => s.status === 'completed').length
  return `Step ${Math.min(t.steps.length, (current >= 0 ? current : done) + 1)} of ${t.steps.length}`
}

// How many cells of each color a bar `width` wide fills at `percent`.
export const barCells = (theme: ZenTheme, bar: string, width: number, percent: number) => {
  const filled = Math.round((width * Math.max(0, Math.min(100, percent))) / 100)
  if (theme !== 'rainbow') return { filled, runs: filled > 0 ? [{ color: bar, cells: filled }] : [] }
  const runs = RAINBOW.map((color, i) => {
    const from = Math.floor((width * i) / RAINBOW.length)
    const to = Math.floor((width * (i + 1)) / RAINBOW.length)
    return { color, cells: Math.max(0, Math.min(to, filled) - from) }
  }).filter(r => r.cells > 0)
  return { filled, runs }
}

// Prism ------------------------------------------------------------------------
// Each theme's one color opened into a window on the color wheel; every cell
// takes its own spot in it, and the spots slide with time.

// Hue from → to, saturation, lightness from → to. Rainbow runs the whole wheel.
type ColorWindow = readonly [number, number, number, number, number]

const WINDOWS: Record<Exclude<ZenTheme, 'custom'>, ColorWindow> = {
  blue: [195, 245, 92, 50, 72],
  green: [125, 175, 80, 42, 66],
  // Chrome: no hue to spread, so only the shade moves.
  dark: [220, 220, 8, 42, 94],
  light: [200, 250, 90, 70, 86],
  rainbow: [0, 300, 95, 58, 58],
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

const hsl = (h: number, s: number, l: number): string => {
  const [sat, light] = [s / 100, l / 100]
  const f = (n: number) => {
    const k = (n + (((h % 360) + 360) % 360) / 30) % 12
    const v = light - sat * Math.min(light, 1 - light) * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(v * 255).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

const toHsl = (hex: string): [number, number, number] => {
  const [r, g, b] = [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number]
  const [max, min] = [Math.max(r, g, b), Math.min(r, g, b)]
  const [l, d] = [(max + min) / 2, max - min]
  if (d === 0) return [0, 0, l * 100]
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [(h * 60 + 360) % 360, (d / (1 - Math.abs(2 * l - 1))) * 100, l * 100]
}

// A custom bar color's window: ±25° around its hue, a shade either side.
const windowOf = (bar: string): ColorWindow => {
  if (!/^#[0-9a-f]{6}$/i.test(bar)) return WINDOWS.blue
  const [h, s, l] = toHsl(bar)
  if (s < 12) return [h, h, s, clamp(l - 30, 25, 60), clamp(l + 20, 70, 95)]
  return [h - 25, h + 25, clamp(s, 60, 95), clamp(l - 12, 35, 60), clamp(l + 14, 60, 85)]
}

const windowFor = (theme: ZenTheme, custom: ZenColors) => (theme === 'custom' ? windowOf(custom.bar) : WINDOWS[theme])

// Folds any number into 0 → 1 → 0, so a narrow window flows back and forth with no seam.
const fold = (x: number) => 1 - Math.abs(2 * (((x % 1) + 1) % 1) - 1)

// The color at spot `k` of the theme's window; `k` may be any number.
export const prismColor = (theme: ZenTheme, custom: ZenColors, k: number): string => {
  const [h1, h2, s, l1, l2] = windowFor(theme, custom)
  if (theme === 'rainbow') return hsl(h1 + (h2 - h1) * k, s, l1)
  const f = fold(k)
  return hsl(h1 + (h2 - h1) * f, s, l1 + (l2 - l1) * f)
}

// One color per filled cell of a bar `width` wide at `seconds`: the window
// flowing along the bar, and a white glint sweeping through it.
export const prismCells = (theme: ZenTheme, custom: ZenColors, width: number, percent: number, seconds: number) => {
  const filled = Math.round((width * clamp(percent, 0, 100)) / 100)
  const glint = (((seconds * 0.55) % 1.5) - 0.25) * Math.max(filled, 1)
  const colors = Array.from({ length: filled }, (_, i) => {
    const k = theme === 'rainbow' ? i / width - seconds / 6 : (i / width) * 0.9 - seconds * 0.14
    const away = Math.abs(i - glint)
    const color = prismColor(theme, custom, k)
    return away < 3 ? mix(color, '#ffffff', (1 - away / 3) * 0.75) : color
  })
  return { filled, colors }
}

// At most `room` steps, keeping the current one in view.
export const visibleSteps = (t: ZenTask, room = 6) => {
  const current = t.steps.findIndex(s => s.status === 'in_progress')
  const first = Math.max(0, Math.min(current - 2, t.steps.length - room))
  return t.steps.slice(first, first + room)
}

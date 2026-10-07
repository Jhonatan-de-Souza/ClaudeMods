// Zen mode's look and arithmetic. Pure; the hooks are in register.tsx.

import type { StepStatus, ZenColors, ZenTask, ZenTheme } from '../../types'

export const ZEN_THEMES: readonly ZenTheme[] = ['blue', 'dark', 'light', 'green', 'rainbow', 'custom']

export const RAINBOW = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7', '#ec4899']

const PRESETS: Record<Exclude<ZenTheme, 'custom'>, ZenColors> = {
  blue: { bar: '#3b82f6', text: '#bfdbfe', border: '#3b82f6' },
  dark: { bar: '#e5e7eb', text: '#d1d5db', border: '#6b7280' },
  light: { bar: '#2563eb', text: '#1f2937', border: '#9ca3af' },
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

// At most `room` steps, keeping the current one in view.
export const visibleSteps = (t: ZenTask, room = 6) => {
  const current = t.steps.findIndex(s => s.status === 'in_progress')
  const first = Math.max(0, Math.min(current - 2, t.steps.length - room))
  return t.steps.slice(first, first + room)
}

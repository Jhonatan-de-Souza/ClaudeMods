import type { Effort } from '../../types'

export const EFFORTS: readonly Effort[] = ['low', 'medium', 'high', 'xhigh', 'max']

export const MODES = ['default', 'plan', 'acceptEdits', 'auto', 'bypassPermissions'] as const

export type Mode = (typeof MODES)[number]

export const MODE_LABELS: Record<string, string> = {
  default: 'ask',
  plan: 'plan',
  acceptEdits: 'accept edits',
  auto: 'auto',
  dontAsk: "don't ask",
  bypassPermissions: 'bypass permissions',
}

export const modeLabel = (m: string | null): string => (m === null ? 'unknown' : (MODE_LABELS[m] ?? m))

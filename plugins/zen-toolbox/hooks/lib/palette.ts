// Terminal palettes: terminalcolors.com's YAML in, Windows Terminal schemes and
// OSC sequences out. Pure functions; nothing here touches the engine.

const ANSI = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'] as const

export type Palette = {
  name: string
  background: string
  foreground: string
  cursor: string
  normal: string[]
  bright: string[]
}

// The themes' YAML (Warp's format): flat `key: value` lines, nested by indentation.
export const parseYaml = (text: string): Record<string, string> => {
  const flat: Record<string, string> = {}
  const parents: { indent: number; key: string }[] = []
  for (const line of text.split(/\r?\n/)) {
    const body = line.trim()
    if (body === '' || body.startsWith('#')) continue
    const match = body.match(/^([\w-]+):\s*(.*)$/)
    if (match === null) continue
    const [, key = '', raw = ''] = match
    const indent = line.length - line.trimStart().length
    while ((parents.at(-1)?.indent ?? -1) >= indent) parents.pop()
    const value = raw.replace(/^(["'])(.*)\1$/, '$2')
    if (value === '') parents.push({ indent, key })
    else flat[[...parents.map(p => p.key), key].join('.')] = value
  }
  return flat
}

export const toPalette = (yaml: string): Palette | null => {
  const flat = parseYaml(yaml)
  const normal = ANSI.map(c => flat[`terminal_colors.normal.${c}`] ?? '')
  const bright = ANSI.map(c => flat[`terminal_colors.bright.${c}`] ?? '')
  if (!flat.background || !flat.foreground || [...normal, ...bright].some(c => c === '')) return null
  return {
    name: flat.name ?? 'Unnamed',
    background: flat.background,
    foreground: flat.foreground,
    cursor: flat.cursor ?? flat.foreground,
    normal,
    bright,
  }
}

// Windows Terminal's settings.json is JSON with comments and trailing commas.
export const parseJsonc = (text: string): unknown => {
  let out = ''
  let inString = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inString) {
      out += c
      if (c === '\\') out += text[++i] ?? ''
      else if (c === '"') inString = false
    } else if (c === '"') {
      inString = true
      out += c
    } else if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++
      out += '\n'
    } else if (c === '/' && text[i + 1] === '*') {
      i = text.indexOf('*/', i + 2)
      if (i < 0) break
      i++
    } else out += c
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'))
}

export type WtProfile = { guid?: string; colorScheme?: unknown }
export type WtSettings = {
  schemes?: Record<string, unknown>[]
  profiles?: { defaults?: WtProfile; list?: WtProfile[] } | WtProfile[]
}

// The profile this Claude Code runs in, else the defaults every profile inherits.
export const targetProfile = (settings: WtSettings, profileId: string | null): WtProfile => {
  const profiles = settings.profiles
  const list = Array.isArray(profiles) ? profiles : (profiles?.list ?? [])
  const id = profileId?.toLowerCase()
  const mine = id ? list.find(p => p.guid?.toLowerCase() === id) : undefined
  if (mine !== undefined) return mine
  if (Array.isArray(profiles) || profiles === undefined) settings.profiles = { defaults: {}, list }
  const holder = settings.profiles as { defaults?: WtProfile }
  holder.defaults ??= {}
  return holder.defaults
}

export const toWtScheme = (p: Palette): Record<string, string> => {
  const names = ['black', 'red', 'green', 'yellow', 'blue', 'purple', 'cyan', 'white']
  const scheme: Record<string, string> = {
    name: p.name,
    background: p.background,
    foreground: p.foreground,
    cursorColor: p.cursor,
    selectionBackground: p.bright[0] ?? p.foreground,
  }
  names.forEach((n, i) => {
    scheme[n] = p.normal[i] ?? p.foreground
    scheme[`bright${n.charAt(0).toUpperCase()}${n.slice(1)}`] = p.bright[i] ?? p.foreground
  })
  return scheme
}

const OSC = (body: string) => `\u001b]${body}\u0007`

// The sequences that recolor the terminal (null resets it to its own colors).
export const oscFor = (p: Palette | null): string =>
  p === null
    ? OSC('104') + OSC('110') + OSC('111') + OSC('112')
    : [...p.normal, ...p.bright].map((c, i) => OSC(`4;${i};${c}`)).join('') +
      OSC(`10;${p.foreground}`) +
      OSC(`11;${p.background}`) +
      OSC(`12;${p.cursor}`)

export const matchAll = (html: string, re: RegExp): string[] =>
  [...html.matchAll(re)].flatMap(m => (m[1] === undefined ? [] : [m[1]]))

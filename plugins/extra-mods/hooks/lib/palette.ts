// Terminal palettes: terminalcolors.com's YAML in, Windows Terminal schemes and
// OSC sequences out. Pure functions; nothing here touches the engine.

const ANSI = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white'] as const

export type Palette = {
  name: string
  background: string
  foreground: string
  cursor: string
  accent: string
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
    accent: flat.accent ?? normal[5] ?? flat.foreground,
    normal,
    bright,
  }
}

// Claude Code themes ------------------------------------------------------------

const rgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? [...h].map(c => c + c).join('') : h.slice(0, 6)
  const n = Number.parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const hex = (c: readonly number[]): string =>
  `#${c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`

// `amount` of the way from color `a` to color `b`.
export const mix = (a: string, b: string, amount: number): string => {
  const [x, y] = [rgb(a), rgb(b)]
  return hex(x.map((v, i) => v + ((y[i] ?? v) - v) * amount))
}

export const isLight = (color: string): boolean => {
  const [r, g, b] = rgb(color)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 140
}

export type ClaudeTheme = { name: string; base: 'dark' | 'light'; overrides: Record<string, string> }

// A Claude Code custom theme (~/.claude/themes/<slug>.json) in the palette's
// colors. Claude Code keeps the terminal's own background; the colors it draws
// on it (text, accents, borders, diffs, message backgrounds) come from here.
// Every color token Claude Code has (2.1.292) is set: a token left out keeps
// the base theme's color, so a partial theme looks like dark/light with a tint.
export const toClaudeTheme = (p: Palette): ClaudeTheme => {
  const fg = p.foreground
  const bg = p.background
  const [, red = fg, green = fg, yellow = fg, blue = fg, magenta = fg, cyan = fg] = p.normal
  const [gray = mix(bg, fg, 0.5), redB = red, greenB = green, yellowB = yellow, blueB = blue, magentaB = magenta] = p.bright
  const orange = mix(red, yellow, 0.5)
  const indigo = mix(blue, magenta, 0.5)
  // The lighter (dark themes) or darker (light themes) twin an animation pulses to.
  const shimmer = (c: string) => mix(c, fg, 0.35)
  const rainbow = { red, orange, yellow, green, blue: cyan, indigo, violet: magenta }
  return {
    name: p.name,
    base: isLight(bg) ? 'light' : 'dark',
    overrides: {
      claude: p.accent,
      claudeShimmer: shimmer(p.accent),
      claudeBlue_FOR_SYSTEM_SPINNER: blue,
      claudeBlueShimmer_FOR_SYSTEM_SPINNER: shimmer(blue),
      text: fg,
      inverseText: bg,
      inactive: gray,
      inactiveShimmer: shimmer(gray),
      subtle: mix(bg, fg, 0.3),
      background: cyan,
      suggestion: blue,
      permission: blue,
      permissionShimmer: shimmer(blue),
      remember: magenta,
      skill: magentaB,
      success: green,
      error: red,
      warning: yellow,
      warningShimmer: shimmer(yellow),
      planMode: cyan,
      autoAccept: magenta,
      autoAcceptShimmer: shimmer(magenta),
      promptBorder: mix(bg, fg, 0.35),
      promptBorderShimmer: mix(bg, fg, 0.6),
      bashBorder: magenta,
      ide: blue,
      merged: magenta,
      professionalBlue: blueB,
      chromeYellow: yellowB,
      fastMode: orange,
      fastModeShimmer: shimmer(orange),
      effortUltra: magenta,
      briefLabelYou: blue,
      briefLabelClaude: p.accent,
      clawd_body: p.accent,
      clawd_background: bg,
      rate_limit_fill: blue,
      rate_limit_empty: mix(bg, blue, 0.3),
      red_FOR_SUBAGENTS_ONLY: red,
      blue_FOR_SUBAGENTS_ONLY: blue,
      green_FOR_SUBAGENTS_ONLY: green,
      yellow_FOR_SUBAGENTS_ONLY: yellow,
      purple_FOR_SUBAGENTS_ONLY: magenta,
      orange_FOR_SUBAGENTS_ONLY: orange,
      pink_FOR_SUBAGENTS_ONLY: magentaB,
      cyan_FOR_SUBAGENTS_ONLY: cyan,
      ...Object.fromEntries(
        Object.entries(rainbow).flatMap(([name, c]) => [
          [`rainbow_${name}`, c],
          [`rainbow_${name}_shimmer`, shimmer(c)],
        ]),
      ),
      userMessageBackground: mix(bg, fg, 0.08),
      userMessageBackgroundHover: mix(bg, fg, 0.12),
      composerSidebarBackground: mix(bg, fg, 0.05),
      bashMessageBackgroundColor: mix(bg, magenta, 0.08),
      memoryBackgroundColor: mix(bg, cyan, 0.08),
      selectionBg: mix(bg, blue, 0.35),
      diffAdded: mix(bg, green, 0.22),
      diffRemoved: mix(bg, red, 0.22),
      diffAddedDimmed: mix(bg, green, 0.12),
      diffRemovedDimmed: mix(bg, red, 0.12),
      diffAddedWord: mix(bg, greenB, 0.45),
      diffRemovedWord: mix(bg, redB, 0.45),
    },
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

// The color scheme the mod writes into Windows Terminal's settings: the kept
// theme, put on the profile Claude Code runs in while a session lasts.
export const WT_SCHEME = 'extra-mods'

const profileList = (settings: WtSettings): WtProfile[] =>
  Array.isArray(settings.profiles) ? settings.profiles : (settings.profiles?.list ?? [])

export const findProfile = (settings: WtSettings, profileId: string): WtProfile | undefined =>
  profileList(settings).find(p => p.guid?.toLowerCase() === profileId.toLowerCase())

// Themes `profile` with the palette, or with null gives it back `original`,
// the scheme it had (undefined: none of its own, so it follows the defaults).
// The mod's scheme stays in the settings only while some profile uses it.
export const withProfileTheme = (settings: WtSettings, profile: WtProfile, palette: Palette | null, original?: unknown): void => {
  if (palette !== null) profile.colorScheme = WT_SCHEME
  else if (original === undefined) delete profile.colorScheme
  else profile.colorScheme = original
  const schemes = (settings.schemes ?? []).filter(s => s.name !== WT_SCHEME)
  const defaults = Array.isArray(settings.profiles) ? undefined : settings.profiles?.defaults
  const inUse = [...profileList(settings), defaults].some(p => p?.colorScheme === WT_SCHEME)
  if (palette !== null) schemes.push({ ...toWtScheme(palette), name: WT_SCHEME })
  settings.schemes = palette !== null || !inUse ? schemes : (settings.schemes ?? [])
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

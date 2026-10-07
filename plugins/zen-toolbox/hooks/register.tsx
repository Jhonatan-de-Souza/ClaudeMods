import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderChildren, RenderInput, Timer } from 'claude-code'

import type { Effort, Panel, ThemeEntry, ZenColors, ZenStep, ZenTask, ZenTheme } from '../types'
import { EFFORTS, type Mode, MODES, modeLabel } from './lib/modes'
import {
  matchAll,
  oscFor,
  type Palette,
  parseJsonc,
  targetProfile,
  toPalette,
  toWtScheme,
  type WtSettings,
} from './lib/palette'
import {
  asStatus,
  barCells,
  colorsFor,
  elapsed,
  percentOf,
  stepLabel,
  visibleSteps,
  ZEN_PROMPT,
  ZEN_TOOL_DESCRIPTION,
  ZEN_TOOL_NAME,
  ZEN_TOOL_SCHEMA,
  ZEN_THEMES,
} from './lib/zen'

// Every value the drawings read. Settings worth keeping across sessions are
// mirrored to $.store under the same key.
const menu = atom({ plugin: 'zen-toolbox', key: 'menu' } as const, null)
const zenOn = atom({ plugin: 'zen-toolbox', key: 'zenOn' } as const, false)
const zenTheme = atom({ plugin: 'zen-toolbox', key: 'zenTheme' } as const, 'blue')
const zenCustom = atom(
  { plugin: 'zen-toolbox', key: 'zenCustom' } as const,
  { bar: '#3b82f6', text: '#e2e8f0', border: '#3b82f6' } satisfies ZenColors,
)
const zenCollapsed = atom({ plugin: 'zen-toolbox', key: 'zenCollapsed' } as const, false)
const task = atom({ plugin: 'zen-toolbox', key: 'task' } as const, null)
const now = atom({ plugin: 'zen-toolbox', key: 'now' } as const, 0)
const themes = atom({ plugin: 'zen-toolbox', key: 'themes' } as const, [])
const themeName = atom({ plugin: 'zen-toolbox', key: 'themeName' } as const, null)
const themeQuery = atom({ plugin: 'zen-toolbox', key: 'themeQuery' } as const, '')
const themeStatus = atom({ plugin: 'zen-toolbox', key: 'themeStatus' } as const, '')
const effort = atom({ plugin: 'zen-toolbox', key: 'effort' } as const, null)
const mode = atom({ plugin: 'zen-toolbox', key: 'mode' } as const, null)
const defaultMode = atom({ plugin: 'zen-toolbox', key: 'defaultMode' } as const, null)
const preview = atom({ plugin: 'zen-toolbox', key: 'preview' } as const, null)
const isDownloading = atom({ plugin: 'zen-toolbox', key: 'isDownloading' } as const, false)

// The menu's pane: a sidebar in the fullscreen layout, a block above the prompt otherwise.
// Claude's progress tool, as the model calls it.
const ZEN_TOOL = 'mcp__zen-toolbox__zen_progress'

const PANE = 'claude-tools'
const PANE_SIZE = { rows: 26, columns: 56 }
// Just short of pure black.
const PANE_BACKGROUND = '#0b0b0b'

const SITE = 'https://terminalcolors.com'
const HEX = /^#[0-9a-f]{6}$/i

// Paths and platform --------------------------------------------------------

async function homeDir($: EngineInterface) {
  const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME')) ?? '.'
  return home.replaceAll('\\', '/')
}

async function themesDir($: EngineInterface) {
  return `${await homeDir($)}/.claude/zen-toolbox/themes`
}

async function isWindows($: EngineInterface) {
  return (await $.env.get('OS')) === 'Windows_NT'
}

// Zen settings ---------------------------------------------------------------

async function setZenOn($: EngineInterface, isOn: boolean) {
  await update($, zenOn, () => isOn)
  await $.store.set('zenOn', isOn)
  if (!isOn) await update($, task, () => null)
}

async function setZenTheme($: EngineInterface, theme: ZenTheme) {
  await update($, zenTheme, () => theme)
  await $.store.set('zenTheme', theme)
}

async function setZenColor($: EngineInterface, part: keyof ZenColors, value: string) {
  if (!HEX.test(value.trim())) {
    $.ui.toast(`${value} is not a hex color like #3b82f6`)
    return
  }
  const colors = await update($, zenCustom, c => ({ ...c, [part]: value.trim() }))
  await $.store.set('zenCustom', colors)
}

// Themes ---------------------------------------------------------------------

async function fetchText($: EngineInterface, url: string) {
  const res = await $.http.fetch(url)
  if (!res.ok) throw new Error(`${res.status} for ${url}`)
  return res.text
}

async function sayTheme($: EngineInterface, text: string) {
  await update($, themeStatus, () => text)
}

// Reads the saved YAML files into the list the picker shows.
async function indexThemes($: EngineInterface) {
  const dir = await themesDir($)
  const list: ThemeEntry[] = []
  if (await $.fs.exists(dir)) {
    for (const entry of await $.fs.list(dir)) {
      if (entry.kind !== 'file' || !entry.name.endsWith('.yaml')) continue
      const palette = toPalette(await $.fs.read(`${dir}/${entry.name}`))
      if (palette !== null) list.push({ slug: entry.name.replace(/\.yaml$/, ''), name: palette.name })
    }
  }
  list.sort((a, b) => a.name.localeCompare(b.name))
  await update($, themes, () => list)
  return list
}

// Scrapes every theme page on terminalcolors.com and saves each theme's YAML.
async function downloadThemes($: EngineInterface) {
  const dir = await themesDir($)
  await sayTheme($, 'Reading terminalcolors.com…')
  const homePage = await fetchText($, `${SITE}/`)
  const variants = new Set(matchAll(homePage, /href="(\/themes\/[\w-]+\/[\w-]+\/)"/g))
  // A family page can list variants the home page leaves out.
  for (const family of new Set(matchAll(homePage, /href="(\/themes\/[\w-]+\/)"/g))) {
    try {
      for (const v of matchAll(await fetchText($, SITE + family), /href="(\/themes\/[\w-]+\/[\w-]+\/)"/g)) {
        variants.add(v)
      }
    } catch {}
  }

  const pages = [...variants]
  let done = 0
  let saved = 0
  // Six downloads at a time.
  for (let i = 0; i < pages.length; i += 6) {
    await Promise.all(
      pages.slice(i, i + 6).map(async page => {
        try {
          const yamlPath = matchAll(await fetchText($, SITE + page), /href="(\/downloads\/warp\/[^"]+\.ya?ml)"/g)[0]
          if (yamlPath === undefined) return
          const yaml = await fetchText($, SITE + yamlPath)
          if (toPalette(yaml) === null) return
          const file = yamlPath.split('/').pop()!.replace(/\.yml$/, '.yaml')
          await $.fs.write(`${dir}/${file}`, yaml)
          saved++
        } catch {
        } finally {
          done++
        }
      }),
    )
    await sayTheme($, `Downloading themes… ${done}/${pages.length}`)
  }

  await indexThemes($)
  await sayTheme($, `Saved ${saved} themes to ${dir}`)
}

type WtOriginal = { path: string; profileId: string | null; colorScheme: unknown }

async function wtSettingsPath($: EngineInterface, profileId: string | null) {
  const local = ((await $.env.get('LOCALAPPDATA')) ?? '').replaceAll('\\', '/')
  const candidates = [
    `${local}/Packages/Microsoft.WindowsTerminal_8wekyb3d8bbwe/LocalState/settings.json`,
    `${local}/Packages/Microsoft.WindowsTerminalPreview_8wekyb3d8bbwe/LocalState/settings.json`,
    `${local}/Microsoft/Windows Terminal/settings.json`,
  ]
  let first: string | null = null
  for (const path of candidates) {
    if (local === '' || !(await $.fs.exists(path))) continue
    first ??= path
    const text = await $.fs.read(path)
    if (profileId !== null && text.toLowerCase().includes(profileId.toLowerCase())) return path
  }
  return first
}

// Windows: writes the scheme into Windows Terminal's settings and points this
// window's profile at it; Windows Terminal reloads the file and repaints.
async function applyWindowsTerminal($: EngineInterface, palette: Palette | null) {
  const profileId = (await $.env.get('WT_PROFILE_ID')) ?? null
  const path = await wtSettingsPath($, profileId)
  if (path === null) throw new Error('Windows Terminal settings not found: run Claude Code in Windows Terminal')
  const original = (await $.store.get('wtOriginal')) as WtOriginal | undefined
  if (palette === null && original === undefined) return

  const text = await $.fs.read(path)
  const backup = `${path}.zen-toolbox.bak`
  if (!(await $.fs.exists(backup))) await $.fs.write(backup, text)
  const settings = parseJsonc(text) as WtSettings
  const profile = targetProfile(settings, profileId)

  if (palette === null) {
    if (original?.colorScheme === null || original?.colorScheme === undefined) delete profile.colorScheme
    else profile.colorScheme = original.colorScheme
    await $.store.delete('wtOriginal')
  } else {
    if (original === undefined) {
      const first: WtOriginal = { path, profileId, colorScheme: profile.colorScheme ?? null }
      await $.store.set('wtOriginal', first)
    }
    const scheme = toWtScheme(palette)
    settings.schemes = [...(settings.schemes ?? []).filter(s => s.name !== scheme.name), scheme]
    profile.colorScheme = scheme.name
  }
  await $.fs.write(path, JSON.stringify(settings, null, 4))
}

// macOS and Linux: OSC color sequences written straight to the terminal.
async function applyOsc($: EngineInterface, palette: Palette | null) {
  const ran = await $.process.run(['sh', '-c', 'printf "%s" "$1" > /dev/tty', 'sh', oscFor(palette)])
  if (ran.exitCode !== 0) throw new Error(ran.stderr.trim() || 'could not write to the terminal')
}

// Recolors the terminal with a saved theme, or with null its own colors.
async function paintTerminal($: EngineInterface, slug: string | null) {
  let palette: Palette | null = null
  if (slug !== null) {
    palette = toPalette(await $.fs.read(`${await themesDir($)}/${slug}.yaml`))
    if (palette === null) throw new Error(`${slug}.yaml is not a theme this mod can read`)
  }
  if (await isWindows($)) await applyWindowsTerminal($, palette)
  else await applyOsc($, palette)
  return palette
}

// Keeps a theme (null: the terminal's own colors) for this and later sessions.
async function applyTheme($: EngineInterface, slug: string | null) {
  const palette = await paintTerminal($, slug)
  await update($, preview, () => null)
  await update($, themeName, () => palette?.name ?? null)
  if (palette === null) await $.store.delete('theme')
  else await $.store.set('theme', { slug: slug!, name: palette.name })
  await sayTheme($, palette ? `Kept ${palette.name}` : 'Terminal colors reset')
}

// Shows a theme on the terminal without keeping it.
async function previewTheme($: EngineInterface, slug: string) {
  const palette = await paintTerminal($, slug)
  await update($, preview, () => slug)
  await sayTheme($, `Previewing ${palette?.name ?? slug}: Enter or click keeps it`)
}

// Puts the kept theme back after a preview that was not kept.
async function endPreview($: EngineInterface) {
  if ((await read($, preview)) === null) return
  const kept = (await $.store.get('theme')) as { slug: string } | undefined
  await paintTerminal($, kept?.slug ?? null)
  await update($, preview, () => null)
  await sayTheme($, '')
}

// The first look at the themes downloads them; once, however often it is asked.
async function ensureThemes($: EngineInterface) {
  if ((await read($, themes)).length > 0 || (await read($, isDownloading))) return
  await update($, isDownloading, () => true)
  try {
    await downloadThemes($)
  } catch (error) {
    await sayTheme($, `Download failed: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    await update($, isDownloading, () => false)
  }
}

// Runs a theme action from a button, reporting a failure in the panel.
function themeAction($: EngineInterface, work: () => Promise<unknown>) {
  return () => {
    void work().catch((error: unknown) =>
      sayTheme($, `Failed: ${error instanceof Error ? error.message : String(error)}`),
    )
  }
}

async function loadThemes($: EngineInterface) {
  const list = await indexThemes($)
  const saved = (await $.store.get('theme')) as { slug: string; name: string } | undefined
  if (saved === undefined) return
  await update($, themeName, () => saved.name)
  // OSC colors last only as long as the terminal does; put them back.
  if (!(await isWindows($)) && list.some(t => t.slug === saved.slug)) {
    void applyTheme($, saved.slug).catch(() => {})
  }
}

// Mode and effort --------------------------------------------------------------

// The effort every request of this session is sent with. When /config has an
// effort row, it is changed too, so Claude Code's own display agrees.
async function setEffort($: EngineInterface, level: Effort) {
  await update($, effort, () => level)
  await $.store.set('effort', level)
  try {
    const row = (await $.config.list()).find(r => /effort/i.test(r.key) && r.options?.includes(level))
    if (row !== undefined) await $.config.set({ key: row.key, value: level })
  } catch {}
  $.ui.toast(`Effort: ${level}`)
}

// permissions.defaultMode in ~/.claude/settings.json: the mode new sessions
// start in. A running session's mode is shift+tab's; a mod cannot set it.
async function setDefaultMode($: EngineInterface, next: Mode) {
  const path = `${await homeDir($)}/.claude/settings.json`
  const text = (await $.fs.exists(path)) ? await $.fs.read(path) : '{}'
  const backup = `${path}.zen-toolbox.bak`
  if (!(await $.fs.exists(backup))) await $.fs.write(backup, text)
  const settings = JSON.parse(text) as { permissions?: Record<string, unknown> }
  settings.permissions = { ...settings.permissions, defaultMode: next }
  await $.fs.write(path, `${JSON.stringify(settings, null, 2)}\n`)
  await update($, defaultMode, () => next)
  $.ui.toast(`New sessions start in ${modeLabel(next)} mode`)
}

async function trackMode($: EngineInterface, current: string | undefined) {
  if (current !== undefined && current !== (await read($, mode))) await update($, mode, () => current)
}

async function loadSettings($: EngineInterface) {
  const saved = {
    zenOn: (await $.store.get('zenOn')) as boolean | undefined,
    zenTheme: (await $.store.get('zenTheme')) as ZenTheme | undefined,
    zenCustom: (await $.store.get('zenCustom')) as ZenColors | undefined,
    effort: (await $.store.get('effort')) as Effort | undefined,
  }
  if (saved.zenOn !== undefined) await update($, zenOn, () => saved.zenOn!)
  if (saved.zenTheme !== undefined && ZEN_THEMES.includes(saved.zenTheme)) await update($, zenTheme, () => saved.zenTheme!)
  if (saved.zenCustom !== undefined) await update($, zenCustom, () => saved.zenCustom!)
  if (saved.effort !== undefined && EFFORTS.includes(saved.effort)) await update($, effort, () => saved.effort!)
  try {
    const { permissions } = await $.settings.read({ source: 'user' })
    const configured = (permissions as { defaultMode?: string } | undefined)?.defaultMode
    await update($, defaultMode, () => configured ?? 'default')
  } catch {}
}

// Drawing ----------------------------------------------------------------------

// Zen's progress band; null when there is nothing to show.
async function drawZenBand($: EngineInterface, e: RenderInput<'AbovePrompt'>) {
  const t = await read($, task)
  if (!(await read($, zenOn)) || t === null) return null

  const theme = await read($, zenTheme)
  const colors = colorsFor(theme, await read($, zenCustom))
  const isCollapsed = await read($, zenCollapsed)
  const clock = await read($, now)
  const { Box, Text, Button } = $.ui.resolve(e)

  const columns = Math.max(30, e.props.bodyColumns ?? 80)
  const percent = percentOf(t)
  const mark = t.doneAt !== null ? '✓' : '✶'
  const width = Math.max(8, columns - 4 - 16 - 6 - (isCollapsed ? Math.min(30, t.title.length + 2) : 0))
  const { filled, runs } = barCells(theme, colors.bar, width, percent)
  const bar = (
    <Box>
      {runs.map(r => (
        <Text color={r.color}>{'█'.repeat(r.cells)}</Text>
      ))}
      <Text dimColor>{'░'.repeat(width - filled)}</Text>
    </Box>
  )
  const toggle = (
    <Button
      key="zen-collapse"
      plain
      dimColor
      label={isCollapsed ? '[+]' : '[–]'}
      onPress={() => update($, zenCollapsed, c => !c)}
    />
  )

  if (isCollapsed) {
    return (
      <Box borderStyle="round" borderColor={colors.border} paddingX={1} gap={1}>
        <Box width={Math.min(30, t.title.length + 2)}>
          <Text color={colors.text} bold wrap="truncate">
            {mark} {t.title}
          </Text>
        </Box>
        {bar}
        <Text color={colors.text} bold>{`${percent}%`.padStart(4)}</Text>
        {toggle}
      </Box>
    )
  }

  const shown = visibleSteps(t)
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={colors.border} paddingX={1}>
      <Box justifyContent="space-between" gap={1}>
        <Text color={colors.text} bold wrap="truncate">
          {mark} {t.title}
        </Text>
        <Box gap={1} flexShrink={0}>
          <Text dimColor>{elapsed((t.doneAt ?? clock) - t.startedAt)}</Text>
          {toggle}
        </Box>
      </Box>
      <Box gap={1}>
        <Text dimColor>{stepLabel(t).padEnd(14)}</Text>
        {bar}
        <Text color={colors.text} bold>{`${percent}%`.padStart(4)}</Text>
      </Box>
      {shown.map(step => {
        const isNow = step.status === 'in_progress'
        return (
          <Box key={`step-${step.id}`} justifyContent="space-between" gap={1}>
            <Text color={isNow ? colors.text : undefined} bold={isNow} dimColor={step.status === 'pending'} wrap="truncate">
              {step.status === 'completed' ? '●' : isNow ? '◉' : '○'} {step.text}
            </Text>
            <Text color={isNow ? colors.text : undefined} dimColor={!isNow}>
              {step.status === 'completed' ? 'Done' : isNow ? 'Working' : 'Next'}
            </Text>
          </Box>
        )
      })}
      {t.steps.length > shown.length && <Text dimColor>{t.steps.length - shown.length} more</Text>}
    </Box>
  )
}

// Moves the menu to another page; leaving the themes ends any preview.
async function goTo($: EngineInterface, panel: Panel) {
  const from = await read($, menu)
  if (from === 'themes' && panel !== 'themes') await endPreview($)
  await update($, menu, () => panel)
  if (panel === 'themes') void ensureThemes($)
}

// Opens the menu in its pane with the keyboard, or closes it.
async function toggleMenu($: EngineInterface, panel: Panel = 'main') {
  if ((await read($, menu)) !== null) {
    // A plugin's own close skips its own ui.close hook, so reset here too.
    await $.ui.close({ id: PANE })
    await endPreview($)
    await update($, menu, () => null)
    return
  }
  await update($, menu, () => panel)
  if (panel === 'themes') void ensureThemes($)
  await $.ui.open({ id: PANE, title: 'Claude Tools', focus: true, closeOnEscape: true, ...PANE_SIZE })
}

// The menu, one item per row so the arrow keys walk it top to bottom.
async function drawPane($: EngineInterface, e: RenderInput<'Pane'>, panel: Panel) {
  if (e.surface !== 'terminal' && e.surface !== 'desktop') return null
  const { Box, Text, Button, Input } = $.ui.resolve(e)
  const isZenOn = await read($, zenOn)
  const zenThemeNow = await read($, zenTheme)
  const level = await read($, effort)
  const running = await read($, mode)
  const theme = (await read($, themeName)) ?? 'Terminal default'

  // A radio row: ● for the chosen one, focusable and pressable.
  const option = (key: string, label: string, isOn: boolean, onPress: () => unknown, swatch?: string) => (
    <Box key={`row-${key}`} gap={1}>
      {swatch !== undefined && <Text color={swatch}>■</Text>}
      <Button key={key} plain label={`${isOn ? '●' : '○'} ${label}`} dimColor={!isOn} onPress={onPress} />
    </Box>
  )
  const heading = (text: string) => (
    <Box key={`h-${text}`} marginTop={1}>
      <Text bold>{text}</Text>
    </Box>
  )
  const page = (title: string, rows: RenderChildren[]) => (
    <Box
      flexDirection="column"
      paddingX={1}
      backgroundColor={PANE_BACKGROUND}
      width={e.props.bodyColumns}
      minHeight={e.props.scroll.bodyRows}
    >
      <Box justifyContent="space-between">
        <Text bold color="claude">
          ◆ {title}
        </Text>
        {title !== 'Claude Tools' && (
          <Button key="tools-back" plain dimColor hotkey="b" label="← back" onPress={() => goTo($, 'main')} />
        )}
      </Box>
      {rows}
      <Box marginTop={1}>
        <Text dimColor>↑↓ move · enter select · esc close</Text>
      </Box>
    </Box>
  )

  if (panel === 'zen') {
    const custom = await read($, zenCustom)
    return page('Zen mode', [
      <Text key="zen-about" dimColor>
        Hides tool calls and their output. Shows Claude's text and a progress band above the prompt.
      </Text>,
      heading('Zen mode'),
      option('zen-on', 'On', isZenOn, () => setZenOn($, true)),
      option('zen-off', 'Off', !isZenOn, () => setZenOn($, false)),
      heading('Band color'),
      ...ZEN_THEMES.map(t => option(`zen-theme-${t}`, t, t === zenThemeNow, () => setZenTheme($, t), colorsFor(t, custom).bar)),
      zenThemeNow === 'custom' && (
        <Box key="zen-custom" flexDirection="column">
          {(['bar', 'text', 'border'] as const).map(part => (
            <Input
              key={`zen-color-${part}`}
              label={`${part} color`}
              value={custom[part]}
              placeholder="#3b82f6"
              submitLabel="set"
              onSubmit={value => setZenColor($, part, value)}
            />
          ))}
        </Box>
      ),
    ])
  }

  if (panel === 'themes') {
    const list = await read($, themes)
    const query = await read($, themeQuery)
    const status = await read($, themeStatus)
    const previewing = await read($, preview)
    const busy = await read($, isDownloading)
    const kept = ((await $.store.get('theme')) as { slug: string } | undefined)?.slug ?? null
    const found = list.filter(t => t.name.toLowerCase().includes(query.trim().toLowerCase()))
    if (list.length === 0) {
      return page('Theme', [
        <Text key="themes-wait" dimColor>
          {status || 'Getting the themes from terminalcolors.com…'}
        </Text>,
        !busy && <Button key="themes-download" plain label="↻ Try again" onPress={() => ensureThemes($)} />,
      ])
    }
    return page('Theme', [
      <Box key="themes-current" gap={1}>
        <Text dimColor>Kept</Text>
        <Text bold>{theme}</Text>
      </Box>,
      <Input
        key="themes-search"
        label="Search"
        value={query}
        placeholder={`${list.length} themes`}
        onInput={value => update($, themeQuery, () => value)}
        onSubmit={value => update($, themeQuery, () => value)}
      />,
      <Text key="themes-hint" dimColor>
        Arrow through the list to preview. Enter keeps one.
      </Text>,
      status !== '' && (
        <Text key="themes-status" color="claude">
          {status}
        </Text>
      ),
      found.length === 0 && (
        <Text key="themes-none" dimColor>
          No theme matches “{query}”.
        </Text>
      ),
      ...found.map(t => (
        <Button
          key={`theme:${t.slug}`}
          plain
          autoFocus={t.slug === (previewing ?? kept) ? true : undefined}
          label={`${t.slug === kept ? '●' : t.slug === previewing ? '◉' : '○'} ${t.name}`}
          dimColor={t.slug !== kept && t.slug !== previewing}
          onPress={themeAction($, () => applyTheme($, t.slug))}
        />
      )),
      heading('More'),
      <Button
        key="themes-reset"
        plain
        dimColor
        label="Reset to the terminal's own colors"
        onPress={themeAction($, () => applyTheme($, null))}
      />,
      <Button key="themes-refresh" plain dimColor label="Download the themes again" onPress={themeAction($, () => downloadThemes($))} />,
    ])
  }

  if (panel === 'mode') {
    const next = await read($, defaultMode)
    return page('Mode', [
      heading('Effort'),
      ...EFFORTS.map(l => option(`effort-${l}`, l, l === level, () => setEffort($, l))),
      heading('Running in'),
      <Text key="mode-running">
        {running === null ? 'Shown after your next prompt' : modeLabel(running)}
        <Text dimColor> · shift+tab switches it</Text>
      </Text>,
      heading('New sessions start in'),
      ...MODES.map(m =>
        option(`default-mode-${m}`, modeLabel(m), m === next, () =>
          setDefaultMode($, m).catch((error: unknown) => $.ui.toast(`Could not save the mode: ${String(error)}`)),
        ),
      ),
      next === 'bypassPermissions' && (
        <Text key="mode-warning" color="warning">
          Bypass skips every permission check. Claude Code asks you to confirm it when the next session starts.
        </Text>
      ),
    ])
  }

  const row = (hotkey: string, name: string, value: string, target: Panel) => (
    <Box key={`row-${target}`} flexDirection="column" marginTop={1}>
      <Button
        key={`open-${target}`}
        plain
        hotkey={hotkey}
        autoFocus={target === 'zen' ? true : undefined}
        label={`${name}  ›`}
        onPress={() => goTo($, target)}
      />
      <Text dimColor>   {value}</Text>
    </Box>
  )
  return page('Claude Tools', [
    row('1', 'Zen mode', isZenOn ? `on · ${zenThemeNow} band` : 'off', 'zen'),
    row('2', 'Theme', theme, 'themes'),
    row('3', 'Mode', `${running === null ? '—' : modeLabel(running)} · effort ${level ?? 'default'}`, 'mode'),
  ])
}

// Zen's elapsed-time ticker, one per module load.
let ticker: Timer | undefined

function stopTicker() {
  ticker?.cancel()
  ticker = undefined
}

// Puts a fresh task on the band and starts its clock.
async function startTask($: EngineInterface, title: string) {
  const startedAt = await $.clock.now()
  const fresh: ZenTask = { title: title || 'Working', startedAt, doneAt: null, steps: [] }
  await update($, task, () => fresh)
  await update($, now, () => startedAt)
  stopTicker()
  ticker = $.clock.every(1000, () => {
    void $.clock.now().then(t => update($, now, () => t))
  })
}

// Hooks ------------------------------------------------------------------------

// Watching hooks end in .catch(... next(e)): when one fails, the event goes on.

export const register: Register = on => {

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await loadSettings($)
    await loadThemes($)
    try {
      await $.tool.register({ name: ZEN_TOOL_NAME, description: ZEN_TOOL_DESCRIPTION, inputSchema: ZEN_TOOL_SCHEMA })
    } catch {}
    await $.command.register({
      name: 'tools',
      description: 'Open the Claude Tools menu: Zen mode, themes, effort and mode',
      argumentHint: '[zen|themes|mode|debug]',
      immediate: true,
    })
    return started
  })

  on('command.run', { command: 'tools' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'debug') {
      const rows = await $.config.list()
      return { text: rows.map(r => `${r.key} (${r.kind}) = ${JSON.stringify(r.value)}`).join('\n') }
    }
    const panel: Panel = arg === 'zen' || arg === 'themes' || arg === 'mode' ? arg : 'main'
    if ((await read($, menu)) !== null) await goTo($, panel)
    else await toggleMenu($, panel)
    return { text: 'Claude Tools is open.' }
  })

  // The menu's pane.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const panel = await read($, menu)
    const drawn = panel === null ? null : await drawPane($, e, panel)
    return drawn ?? $.ui.resolve(e).Text({ children: '' })
  })

  // However the pane closes (esc, its close mark, the corner button), the menu
  // resets and an unkept theme preview is undone.
  on('ui.close', { id: PANE }, async ($, e, next) => {
    const closed = await next(e)
    await endPreview($)
    await update($, menu, () => null)
    return closed
  }).catch(($, e, next) => next(e))

  // Themes: the focus ring landing on a theme previews it on the terminal,
  // once the arrows rest for a moment (each preview rewrites the terminal's settings).
  let previewTimer: Timer | undefined
  on('ui.focus', { requestId: PANE }, async ($, e, next) => {
    const moved = await next(e)
    const slug = e.element?.startsWith('theme:') ? e.element.slice('theme:'.length) : null
    previewTimer?.cancel()
    if (slug !== null && slug !== (await read($, preview))) {
      previewTimer = $.clock.after(250, () => {
        void previewTheme($, slug).catch((error: unknown) =>
          sayTheme($, `Preview failed: ${error instanceof Error ? error.message : String(error)}`),
        )
      })
    }
    return moved
  }).catch(($, e, next) => next(e))

  // Themes: each wheel tick over the pane steps the preview to the next or
  // previous theme in the list (the list scrolls along as usual).
  let wheelSlug: string | null = null
  on('ui.scroll', { requestId: PANE }, async ($, e, next) => {
    const moved = await next(e)
    if (e.pointer === undefined || e.by === 0 || (await read($, menu)) !== 'themes') return moved
    const query = (await read($, themeQuery)).trim().toLowerCase()
    const found = (await read($, themes)).filter(t => t.name.toLowerCase().includes(query))
    if (found.length === 0) return moved
    const kept = ((await $.store.get('theme')) as { slug: string } | undefined)?.slug ?? null
    const current = wheelSlug ?? (await read($, preview)) ?? kept
    const at = found.findIndex(t => t.slug === current)
    const target = found[Math.max(0, Math.min(found.length - 1, at + Math.sign(e.by)))]
    if (target === undefined) return moved
    wheelSlug = target.slug
    void $.ui.focus({ requestId: PANE, key: `theme:${target.slug}` }).catch(() => {})
    previewTimer?.cancel()
    previewTimer = $.clock.after(250, () => {
      wheelSlug = null
      void previewTheme($, target.slug).catch((error: unknown) =>
        sayTheme($, `Preview failed: ${error instanceof Error ? error.message : String(error)}`),
      )
    })
    return moved
  }).catch(($, e, next) => next(e))

  // The corner button, at the end of the hint line under the prompt.
  on('ui.render', { component: 'PromptHint' }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const isOpen = (await read($, menu)) !== null
    const isZen = await read($, zenOn)
    return (
      <Box justifyContent="space-between" width="100%" gap={1}>
        <Text dimColor wrap="truncate">
          {e.props.hint}
        </Text>
        <Button
          key="tools-toggle"
          plain
          label={`◆ Claude Tools${isZen ? ' · zen' : ''} ${isOpen ? '▼' : '▲'}`}
          onPress={() => toggleMenu($)}
        />
      </Box>
    )
  })

  // The band above the prompt: Zen's progress.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    return (await drawZenBand($, e)) ?? next(e)
  })

  // Zen: tool rows draw nothing while it is on.
  on('ui.render', { component: 'ToolUse' }, async ($, e, next) =>
    (await read($, zenOn)) ? $.ui.resolve(e).Box({ display: 'none' }) : next(e),
  )
  on('ui.render', { component: 'ToolResult' }, async ($, e, next) =>
    (await read($, zenOn)) ? $.ui.resolve(e).Box({ display: 'none' }) : next(e),
  )
  on('ui.render', { component: 'ToolGroup' }, async ($, e, next) =>
    (await read($, zenOn)) ? $.ui.resolve(e).Box({ display: 'none' }) : next(e),
  )
  on('ui.render', { component: 'ToolProgress' }, async ($, e, next) =>
    (await read($, zenOn)) ? $.ui.resolve(e).Box({ display: 'none' }) : next(e),
  )

  // Zen: asks Claude to narrate and keep a task list the band can follow.
  // Zen: each prompt typed starts a new task on the band, and carries the Zen
  // instructions for Claude (read with the prompt, never shown).
  let lastPrompt = ''

  on('prompt.submit', async ($, e, next) => {
    const text = e.text.trim()
    const isTyped = e.origin.kind === 'composer' && text !== '' && !text.startsWith('/')
    if (!isTyped) return next(e)
    lastPrompt = (text.split('\n')[0] ?? '').slice(0, 200)
    if (!(await read($, zenOn))) return next(e)
    await startTask($, lastPrompt)
    return next({ ...e, context: [...(e.context ?? []), ZEN_PROMPT] })
  }).catch(($, e, next) => next(e))

  // Zen: Claude's own progress tool. Each call sends the whole step list.
  on('tool.call', { tool: ZEN_TOOL }, async ($, e) => {
    const input = e as unknown as { title?: unknown; steps?: unknown }
    const steps: ZenStep[] = (Array.isArray(input.steps) ? input.steps : []).flatMap((raw: unknown, i) => {
      const step = raw as { text?: unknown; status?: unknown }
      return typeof step.text === 'string' ? [{ id: `zen-${i}`, text: step.text, status: asStatus(step.status) }] : []
    })
    if ((await read($, task)) === null) await startTask($, lastPrompt)
    await update($, task, t =>
      t === null ? t : { ...t, title: typeof input.title === 'string' && input.title !== '' ? input.title : t.title, steps },
    )
    const t = await read($, task)
    const done = steps.filter(s => s.status === 'completed').length
    return { result: `Progress band updated: ${done} of ${steps.length} steps done (${t === null ? 0 : percentOf(t)}%).` }
  })

  on('tool.call', { tool: 'TodoWrite' }, async ($, e, next) => {
    const steps: ZenStep[] = e.todos.map((todo, i) => ({
      id: `todo-${i}`,
      text: todo.status === 'in_progress' ? todo.activeForm || todo.content : todo.content,
      status: asStatus(todo.status),
    }))
    await update($, task, t => (t === null ? t : { ...t, steps }))
    return next(e)
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'TaskCreate' }, async ($, e, next) => {
    const ran = await next(e)
    const id = (ran.result as { task?: { id?: string } } | undefined)?.task?.id
    if (id !== undefined) {
      const step: ZenStep = { id, text: e.subject, status: 'pending' }
      await update($, task, t => (t === null ? t : { ...t, steps: [...t.steps.filter(s => s.id !== id), step] }))
    }
    return ran
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'TaskUpdate' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny !== undefined || ran.isError === true) return ran
    await update($, task, t => {
      if (t === null) return t
      if (e.status === 'deleted') return { ...t, steps: t.steps.filter(s => s.id !== e.taskId) }
      const steps = t.steps.map(s =>
        s.id === e.taskId ? { ...s, text: e.subject ?? s.text, status: e.status ? asStatus(e.status) : s.status } : s,
      )
      return { ...t, steps }
    })
    return ran
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    stopTicker()
    const current = await read($, task)
    if (current !== null && current.doneAt === null) {
      const doneAt = await $.clock.now()
      await update($, task, t => (t === null ? t : { ...t, doneAt }))
      await update($, now, () => doneAt)
      // "Done" stays up for a moment, then the band clears.
      $.clock.after(8000, () => {
        void update($, task, t => (t !== null && t.doneAt === doneAt ? null : t))
      })
    }
    return next(e)
  })

  // Mode: the chosen effort rides on every model request of the session.
  on('turn.step', async function* ($, e, next) {
    const level = await read($, effort)
    return yield* next(level !== null && e.effort !== undefined ? { ...e, effort: level } : e)
  })

  // Mode: the running permission mode, as the engine reports it to hooks.
  on('classic.UserPromptSubmit', async ($, e, next) => {
    await trackMode($, e.permission_mode)
    return next(e)
  }).catch(($, e, next) => next(e))
  on('classic.PostToolUse', async ($, e, next) => {
    await trackMode($, e.permission_mode)
    return next(e)
  }).catch(($, e, next) => next(e))
}

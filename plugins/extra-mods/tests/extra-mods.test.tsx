import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import {
  findProfile,
  oscFor,
  parseJsonc,
  targetProfile,
  toClaudeTheme,
  toPalette,
  toWtScheme,
  withProfileTheme,
  WT_SCHEME,
  type WtSettings,
} from '../hooks/lib/palette'
import { barCells, percentOf, stepLabel, visibleSteps } from '../hooks/lib/zen'
import { backgroundPill, barFill, cacheState, CACHE_TTL_MS, colorFor, fmtDuration, fmtTokens } from '../hooks/lib/status'

const PLUGIN = 'extra-mods'
const SURFACES = ['terminal', 'desktop'] as const

const DRACULA = `name: Dracula Default
accent: "#ff79c6"
cursor: "#ff79c6"
background: "#282a36"
foreground: "#f8f8f2"
details: darker
terminal_colors:
  bright:
    black: "#6272a4"
    blue: "#d6acff"
    cyan: "#a4ffff"
    green: "#69ff94"
    magenta: "#ff92df"
    red: "#ff6e6e"
    white: "#ffffff"
    yellow: "#ffffa5"
  normal:
    black: "#21222c"
    blue: "#bd93f9"
    cyan: "#8be9fd"
    green: "#50fa7b"
    magenta: "#ff79c6"
    red: "#ff5555"
    white: "#f8f8f2"
    yellow: "#f1fa8c"
`

const band = (bodyColumns = 80) => ({
  component: 'AbovePrompt' as const,
  props: { hasSurvey: false, isWorking: false, maxRows: 20, bodyColumns, scroll: { offset: 0, bodyRows: 20 }, view: {} },
})

const pane = {
  component: 'Pane' as const,
  requestId: 'claude-tools',
  props: {
    title: 'extra-mods',
    isFocused: true,
    bodyColumns: 56,
    placement: 'dock' as const,
    scroll: { offset: 0, bodyRows: 26 },
    view: {},
  },
}

const hint = {
  component: 'PromptHint' as const,
  props: { isDraft: false, isWorking: false, hint: '? for shortcuts' },
}

describe('themes', () => {
  test('reads terminalcolors.com YAML into a palette', async () => {
    const p = toPalette(DRACULA)
    expect(p?.name).toBe('Dracula Default')
    expect(p?.background).toBe('#282a36')
    expect(p?.normal).toEqual(['#21222c', '#ff5555', '#50fa7b', '#f1fa8c', '#bd93f9', '#ff79c6', '#8be9fd', '#f8f8f2'])
    expect(p?.bright[7]).toBe('#ffffff')
    expect(toPalette('name: broken\n')).toBe(null)
  })

  test('maps a palette to a Claude Code theme', async () => {
    const theme = toClaudeTheme(toPalette(DRACULA)!)
    expect(theme.name).toBe('Dracula Default')
    expect(theme.base).toBe('dark')
    expect(theme.overrides.claude).toBe('#ff79c6')
    expect(theme.overrides.text).toBe('#f8f8f2')
    expect(theme.overrides.error).toBe('#ff5555')
    expect(theme.overrides.success).toBe('#50fa7b')
    expect(theme.overrides.userMessageBackground).toMatch(/^#[0-9a-f]{6}$/)
  })

  test('sets every Claude Code color token, so none falls back to the base theme', async () => {
    const { overrides } = toClaudeTheme(toPalette(DRACULA)!)
    expect(Object.keys(overrides)).toHaveLength(72)
    for (const key of ['selectionBg', 'skill', 'clawd_body', 'rate_limit_fill', 'orange_FOR_SUBAGENTS_ONLY', 'rainbow_violet_shimmer'])
      expect(overrides[key]).toMatch(/^#[0-9a-f]{6}$/)
  })

  test('maps a palette to a Windows Terminal scheme', async () => {
    const scheme = toWtScheme(toPalette(DRACULA)!)
    expect(scheme.name).toBe('Dracula Default')
    expect(scheme.purple).toBe('#ff79c6')
    expect(scheme.brightPurple).toBe('#ff92df')
    expect(scheme.cursorColor).toBe('#ff79c6')
  })

  test("parses Windows Terminal's commented settings and finds this window's profile", async () => {
    const text = `{
      // the defaults
      "profiles": { "defaults": {}, "list": [ { "guid": "{ABC}", "name": "PowerShell", }, ] },
      /* schemes */ "schemes": [],
      "url": "https://example.com//not-a-comment"
    }`
    const settings = parseJsonc(text) as WtSettings & { url: string }
    expect(settings.url).toBe('https://example.com//not-a-comment')
    targetProfile(settings, '{abc}').colorScheme = 'Dracula Default'
    expect(JSON.stringify(settings)).toContain('"colorScheme":"Dracula Default"')
    targetProfile(settings, null).colorScheme = 'Nord'
    expect((settings.profiles as { defaults: { colorScheme: string } }).defaults.colorScheme).toBe('Nord')
  })

  test("themes the profile Claude Code runs in, then gives it its own scheme back", async () => {
    const mine = { guid: '{ABC}', name: 'PowerShell', colorScheme: 'One Half Dark' }
    const other = { guid: '{DEF}', name: 'Ubuntu' }
    const settings: WtSettings = { profiles: { defaults: { colorScheme: 'CGA' }, list: [mine, other] }, schemes: [{ name: 'Mine' }] }
    const profile = findProfile(settings, '{abc}')!
    expect(profile).toBe(mine)

    withProfileTheme(settings, profile, toPalette(DRACULA), 'One Half Dark')
    expect(mine.colorScheme).toBe(WT_SCHEME)
    expect(other).toEqual({ guid: '{DEF}', name: 'Ubuntu' })
    expect(settings.schemes).toEqual([{ name: 'Mine' }, { ...toWtScheme(toPalette(DRACULA)!), name: WT_SCHEME }])

    withProfileTheme(settings, profile, null, 'One Half Dark')
    expect(mine.colorScheme).toBe('One Half Dark')
    expect(settings.schemes).toEqual([{ name: 'Mine' }])

    // A profile with no scheme of its own goes back to following the defaults.
    withProfileTheme(settings, other, toPalette(DRACULA))
    withProfileTheme(settings, other, null)
    expect(other).toEqual({ guid: '{DEF}', name: 'Ubuntu' })
  })

  test('writes OSC sequences for macOS and Linux terminals', async () => {
    const seq = oscFor(toPalette(DRACULA))
    expect(seq).toContain('\u001b]11;#282a36\u0007')
    expect(seq).toContain('\u001b]4;15;#ffffff\u0007')
    expect(oscFor(null)).toBe('\u001b]104\u0007\u001b]110\u0007\u001b]111\u0007\u001b]112\u0007')
  })
})

describe('status line', () => {
  test('formats like the old statusline script', async () => {
    expect(fmtTokens(306_000)).toBe('306k')
    expect(fmtTokens(1_000_000)).toBe('1M')
    expect(fmtDuration(110 * 60_000)).toBe('1h50m')
    expect(fmtDuration(24 * 3_600_000)).toBe('1d00h')
    expect(barFill(34)).toBe(3)
    expect(colorFor(95)).toBe('#ef4444')
  })

  test('cache is ok inside the hour and over after it', async () => {
    expect(cacheState(null, 1000)).toBe(null)
    expect(cacheState(0, CACHE_TTL_MS - 1)).toBe('ok')
    expect(cacheState(0, CACHE_TTL_MS)).toBe('over')
  })

  test("reads the engine's shell and monitor pill out of its hint", async () => {
    expect(backgroundPill('? for shortcuts')).toBe(null)
    expect(backgroundPill('1 shell · ? for shortcuts')).toBe('1 shell')
    expect(backgroundPill('esc to interrupt 2 shells, 1 monitor')).toBe('2 shells, 1 monitor')
    expect(backgroundPill('1 monitor')).toBe('1 monitor')
    expect(backgroundPill('3 background tasks · ? for shortcuts')).toBe('3 background tasks')
    expect(backgroundPill('ran 2 shell commands')).toBe(null)
  })
})

describe('zen math', () => {
  const steps = (...s: ('pending' | 'in_progress' | 'completed')[]) =>
    s.map((status, i) => ({ id: String(i), text: `step ${i}`, status }))

  test('percent and step label follow the task list', async () => {
    const t = { title: 'x', startedAt: 0, doneAt: null, steps: steps('completed', 'in_progress', 'pending', 'pending') }
    expect(percentOf(t)).toBe(25)
    expect(stepLabel(t)).toBe('Step 2 of 4')
    expect(percentOf({ ...t, steps: [] })).toBe(0)
    expect(stepLabel({ ...t, steps: [] })).toBe('Working…')
    expect(percentOf({ ...t, doneAt: 5 })).toBe(100)
  })

  test('the bar fills its width, in one color or a rainbow', async () => {
    expect(barCells('blue', '#3b82f6', 40, 50)).toEqual({ filled: 20, runs: [{ color: '#3b82f6', cells: 20 }] })
    const rainbow = barCells('rainbow', '', 40, 100)
    expect(rainbow.runs).toHaveLength(8)
    expect(rainbow.runs.reduce((n, r) => n + r.cells, 0)).toBe(40)
  })

  test('long lists keep the current step in view', async () => {
    const t = { title: 'x', startedAt: 0, doneAt: null, steps: steps(...Array(5).fill('completed'), 'in_progress', 'pending', 'pending', 'pending', 'pending') }
    const shown = visibleSteps(t)
    expect(shown).toHaveLength(6)
    expect(shown.some(s => s.status === 'in_progress')).toBe(true)
  })
})

// Stands in for the engine's own drawing where the mod passes.
const engineDraws = (on: On) => {
  mock.store(on)
  on('ui.render', ($, e) => $.ui.resolve(e).Text({ children: 'engine' }))
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  on('ui.close', () => ({ value: undefined }))
}

describe('toolbox', () => {
  test('the corner button opens the menu in its pane', async ($, on) => {
    engineDraws(on)
    for (const surface of SURFACES) {
      const corner = await $.ui.mount({ plugin: PLUGIN, surface, ...hint })
      const menu = await $.ui.mount({ plugin: PLUGIN, surface, ...pane })
      expect((await corner.find({ key: 'tools-toggle' }))?.text).toMatch(/extra-mods ▲/)
      expect(await menu.find({ key: 'open-zen' })).toBeUndefined()

      await corner.press({ key: 'tools-toggle' })
      expect((await corner.find({ key: 'tools-toggle' }))?.text).toMatch(/▼/)
      for (const key of ['open-zen', 'open-themes', 'open-mode']) {
        expect(await menu.find({ key })).toBeDefined()
      }
      await corner.press({ key: 'tools-toggle' })
      await corner.unmount()
      await menu.unmount()
    }
  })

  test('Zen mode and its band color are set from the menu', async ($, on) => {
    engineDraws(on)
    const surface = 'terminal'
    const corner = await $.ui.mount({ plugin: PLUGIN, surface, ...hint })
    const menu = await $.ui.mount({ plugin: PLUGIN, surface, ...pane })
    await corner.press({ key: 'tools-toggle' })
    await menu.press({ key: 'open-zen' })
    await menu.press({ key: 'zen-on' })
    await menu.press({ key: 'zen-theme-rainbow' })
    expect((await menu.find({ key: 'zen-on' }))?.text).toMatch(/● On/)
    expect((await menu.find({ key: 'zen-theme-rainbow' }))?.text).toMatch(/● rainbow/)

    await menu.press({ key: 'tools-back' })
    expect(await menu.find({ text: /on · rainbow band/ })).toBeDefined()

    await menu.press({ key: 'open-zen' })
    await menu.press({ key: 'zen-off' })
    expect((await menu.find({ key: 'zen-off' }))?.text).toMatch(/● Off/)
  })

  test('the mode page lists effort levels and new-session modes', async ($, on) => {
    engineDraws(on)
    const menu = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', ...pane })
    const corner = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', ...hint })
    await corner.press({ key: 'tools-toggle' })
    await menu.press({ key: 'open-mode' })
    for (const level of ['low', 'medium', 'high', 'xhigh', 'max']) {
      expect(await menu.find({ key: `effort-${level}` })).toBeDefined()
    }
    expect(await menu.find({ key: 'default-mode-bypassPermissions' })).toBeDefined()
    await menu.press({ key: 'effort-high' })
    await menu.press({ key: 'tools-back' })
    expect(await menu.find({ text: /effort high/ })).toBeDefined()
  })

  test('the mode page switches the model through /model', async ($, on) => {
    engineDraws(on)
    let current = 'claude-opus-5-5'
    const ran: string[] = []
    on('command.run', { command: 'model' }, async (_$, e) => {
      ran.push(e.args)
      current = e.args === 'sonnet' ? 'claude-sonnet-5-5' : current
      return { text: `Set model to ${e.args}` }
    })
    on('session.model', () => ({ value: current }))
    const menu = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', ...pane })
    const corner = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', ...hint })
    await corner.press({ key: 'tools-toggle' })
    await menu.press({ key: 'open-mode' })
    for (const alias of ['fable', 'opus', 'sonnet', 'haiku', 'default']) {
      expect(await menu.find({ key: `model-${alias}` })).toBeDefined()
    }
    await menu.press({ key: 'model-sonnet' })
    expect(ran).toEqual(['sonnet'])
    expect((await menu.find({ key: 'model-sonnet' }))?.text).toMatch(/● Sonnet/)
    await menu.press({ key: 'tools-back' })
    expect(await menu.find({ text: /Sonnet 5\.5 · / })).toBeDefined()
  })

  test('a running shell or monitor gets a second row under the status line', async ($, on) => {
    engineDraws(on)
    const ran: string[] = []
    on('command.run', { command: 'tasks' }, async (_$, e) => {
      ran.push(e.command)
      return { text: '' }
    })
    const busy = { ...hint, props: { ...hint.props, hint: '1 shell, 1 monitor · ? for shortcuts' } }
    // The status line, turned on from the menu over an empty settings.json.
    on('env.get', () => ({ value: '/home/me' }))
    on('fs.exists', () => ({ value: false }))
    on('fs.write', () => ({ value: undefined }))
    on('session.model', () => ({ value: 'claude-opus-5-5' }))
    on('session.cwd', () => ({ value: '/work/ClaudeMods' }))
    on('session.usage', () => ({
      value: { context: { percent: 12, tokens: 24_000, window: 200_000 }, rateLimits: [] },
    }) as never)
    on('process.run', () => ({ value: { exitCode: 0, stdout: 'main\n', stderr: '' } }) as never)
    const menu = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', ...pane })
    const opener = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', ...hint })
    await opener.press({ key: 'tools-toggle' })
    await menu.press({ key: 'open-status' })
    await menu.press({ key: 'status-on' })
    await opener.press({ key: 'tools-toggle' })
    await opener.unmount()
    await menu.unmount()
    const idle = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', ...hint })
    expect(await idle.find({ key: 'background-tasks' })).toBeUndefined()
    await idle.unmount()

    const corner = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', ...busy })
    expect((await corner.find({ key: 'background-tasks' }))?.text).toMatch(/1 shell, 1 monitor/)
    expect(await corner.find({ text: /Opus 5\.5 · ClaudeMods/ })).toBeDefined()
    expect(await corner.find({ key: 'tools-toggle' })).toBeDefined()
    await corner.press({ key: 'background-tasks' })
    expect(ran).toEqual(['tasks'])
  })

  test("Claude's zen_progress calls fill the band", async ($, on) => {
    engineDraws(on)
    mock.clock(on)
    const corner = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', ...hint })
    const menu = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', ...pane })
    const progress = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', ...band() })
    await corner.press({ key: 'tools-toggle' })
    await menu.press({ key: 'open-zen' })
    await menu.press({ key: 'zen-on' })

    await $.tool.call({
      tool: 'mcp__extra-mods__zen_progress',
      title: 'Build the dashboard',
      steps: [
        { text: 'Plan', status: 'completed' },
        { text: 'Fetch data', status: 'in_progress' },
        { text: 'Draw charts', status: 'pending' },
        { text: 'Test', status: 'completed' },
      ],
    } as never)
    expect(await progress.find({ text: /Build the dashboard/ })).toBeDefined()
    expect(await progress.find({ text: /50%/ })).toBeDefined()
    expect(await progress.find({ text: /Step 2 of 4/ })).toBeDefined()
    expect(await progress.find({ text: /Fetch data/ })).toBeDefined()
  })
})

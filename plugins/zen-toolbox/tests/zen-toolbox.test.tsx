import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { oscFor, parseJsonc, targetProfile, toPalette, toWtScheme, type WtSettings } from '../hooks/lib/palette'
import { barCells, percentOf, stepLabel, visibleSteps } from '../hooks/lib/zen'

const PLUGIN = 'zen-toolbox'
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
    title: 'Claude Tools',
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

  test('writes OSC sequences for macOS and Linux terminals', async () => {
    const seq = oscFor(toPalette(DRACULA))
    expect(seq).toContain('\u001b]11;#282a36\u0007')
    expect(seq).toContain('\u001b]4;15;#ffffff\u0007')
    expect(oscFor(null)).toBe('\u001b]104\u0007\u001b]110\u0007\u001b]111\u0007\u001b]112\u0007')
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
  on('ui.render', ($, e) => $.ui.resolve(e).Text({ key: 'engine', children: 'engine' }))
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  on('ui.close', () => ({ value: undefined }))
}

describe('toolbox', () => {
  test('the corner button opens the menu in its pane', async ($, on) => {
    engineDraws(on)
    for (const surface of SURFACES) {
      const corner = await $.ui.mount({ plugin: PLUGIN, surface, ...hint })
      const menu = await $.ui.mount({ plugin: PLUGIN, surface, ...pane })
      expect((await corner.find({ key: 'tools-toggle' }))?.text).toMatch(/Claude Tools ▲/)
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
    expect((await corner.find({ key: 'tools-toggle' }))?.text).toMatch(/zen/)
    expect((await menu.find({ key: 'zen-theme-rainbow' }))?.text).toMatch(/● rainbow/)

    await menu.press({ key: 'tools-back' })
    expect(await menu.find({ text: /on · rainbow band/ })).toBeDefined()

    await menu.press({ key: 'open-zen' })
    await menu.press({ key: 'zen-off' })
    expect((await corner.find({ key: 'tools-toggle' }))?.text).not.toMatch(/zen/)
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
      tool: 'mcp__zen-toolbox__zen_progress',
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

# Claude Mods

Mods for [Claude Code](https://claude.com/claude-code).

## zen-toolbox: Claude Tools

A **◆ Claude Tools ▲** button in the bottom-right corner, at the end of the hint line under the prompt. Click it, or type `/tools`, to open the menu in a pane. In the fullscreen layout the pane is a sidebar on the right; in other layouts it opens as a block above the prompt. The pane takes the keyboard: **↑↓** move, **Enter** selects, **b** goes back and **Esc** closes.

### 1. Zen mode

- Hides every tool call and its output. You see only what Claude writes.
- Gives Claude a `zen_progress` tool and asks it, with every prompt you send, to post its plan and update it as each step starts and finishes.
- Shows a progress band above the prompt with the task, the current step, a progress bar, the percentage and the elapsed time. `[–]` shrinks it to one line.
- Band colours: `blue`, `dark`, `light`, `green`, `rainbow`, or `custom` with your own hex colours for the bar, text and border.

### 2. Theme

- The first time you open it, it scrapes every theme on terminalcolors.com and saves its YAML to `~/.claude/zen-toolbox/themes/`.
- Arrowing through the list **previews** each theme on the whole terminal window. **Enter** keeps one; leaving without keeping puts your kept theme back.
  - **Windows:** the mod writes the theme into Windows Terminal's `settings.json` as a colour scheme and points the current profile (`WT_PROFILE_ID`) at it. Windows Terminal reloads the file and repaints the window. It saves a backup first, as `settings.json.zen-toolbox.bak`.
  - **macOS / Linux:** the mod sends OSC colour sequences to the terminal and applies them again at every session start. Works in iTerm2, Ghostty, kitty, WezTerm, Alacritty and most other modern terminals.
- **Reset colors** puts back your original colours.

### 3. Mode

- **Effort:** `low` / `medium` / `high` / `xhigh` / `max`. Applies to every request from then on and is remembered across sessions.
- **Running in:** the current permission mode. Claude Code doesn't let mods switch the mode of a running session, so use **shift+tab** for that.
- **New sessions:** sets `permissions.defaultMode` in `~/.claude/settings.json` (ask, plan, accept edits, auto or bypass permissions). The mod saves a backup first, as `settings.json.zen-toolbox.bak`.

## Install

```
/plugin install zen-toolbox --marketplace <owner>/ClaudeMods
```

## Develop

```
claude --plugin-dir ./plugins/zen-toolbox
claude plugin validate ./plugins/zen-toolbox
claude plugin test ./plugins/zen-toolbox
```

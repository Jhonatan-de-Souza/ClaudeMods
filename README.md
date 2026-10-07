# Claude Mods

**English** · [Português](README.pt-BR.md)

Mods for [Claude Code](https://claude.com/claude-code). One plugin, `zen-toolbox`, adds an **◆ extra-mods ▲** button in the bottom-right corner, under the prompt. It opens a sidebar with five tools:

| Tool | What it does |
|---|---|
| **Zen mode** | Hides tool calls and their output, and shows Claude's plan as a progress band above the prompt |
| **Theme** | Recolors the whole terminal with any theme from [terminalcolors.com](https://terminalcolors.com), with live preview |
| **Mode** | Sets the effort level, and the permission mode new sessions start in |
| **Status line** | Model, folder, branch, context, 5h/7d limits and cache state, with the button on the same row |
| **Privacy** | Hides your account email and organization name in Claude Code's header (demo mode) |

## Install

You need Claude Code 2.1.292 or newer. Run these in a terminal:

```
claude plugin marketplace add Jhonatan-de-Souza/ClaudeMods
claude plugin install zen-toolbox@jdsjh-mods --scope user
```

Then start a new Claude Code session, or run `/reload-plugins` in an open one. The button shows up at the bottom right of every session.

### Install with an AI agent

You can point your coding agent at this repository and ask it to install the mod. The steps below are written for the agent.

> **Agent instructions.** Follow these steps in order. Ask the user before step 4 or step 5, because those change their settings.
>
> 1. Check Claude Code is installed and recent enough: run `claude --version`. It must print 2.1.292 or higher. If it doesn't, stop and tell the user to update Claude Code.
> 2. Add this repository as a plugin marketplace: run `claude plugin marketplace add Jhonatan-de-Souza/ClaudeMods`. It should print `Successfully added marketplace: jdsjh-mods`. If the marketplace already exists, continue.
> 3. Install the plugin for all sessions: run `claude plugin install zen-toolbox@jdsjh-mods --scope user`. It should print `Successfully installed plugin: zen-toolbox@jdsjh-mods`.
> 4. *Optional, ask first:* hide the account email and organization name in Claude Code's header (demo mode). In `~/.claude/settings.json`, add `"IS_DEMO": "1"` to the `env` object (create `env` if it is missing). This is what the mod's **Privacy** toggle does, and it applies from the next session.
> 5. *Optional, ask first, and only if the user does not want the mod's built-in status line:* install the standalone status line script. Copy `statusline/statusline.py` from this repository to `~/.claude/statusline.py`. Then in `~/.claude/settings.json` set `"statusLine": { "type": "command", "command": "python ~/.claude/statusline.py", "refreshInterval": 2 }` (use `python3` on macOS and Linux). It needs Python 3.
> 6. Verify: run `claude plugin list`. `zen-toolbox` must be listed and enabled.
> 7. Tell the user to run `/reload-plugins` or start a new session, then click **◆ extra-mods ▲** at the bottom right, or type `/tools`.
>
> On Windows, write paths with forward slashes (`C:/Users/...`) when a command runs in a POSIX shell such as Git Bash.

## Using it

Click **◆ extra-mods ▲**, or type `/tools`, to open the sidebar. In Claude Code's fullscreen layout it docks on the right; otherwise it opens above the prompt. The sidebar takes the keyboard: **↑↓** move, **Enter** selects, **b** goes back, **Esc** closes. Its background follows your terminal's.

### 1. Zen mode

- Hides every tool call and its output. You see only what Claude writes.
- Gives Claude a `zen_progress` tool and asks it, with every prompt you send, to post its plan first and update it as each step starts and finishes.
- Shows a progress band above the prompt: the task, the current step, a progress bar, the percentage and the elapsed time. `[–]` shrinks it to one line.
- Band colors: `blue`, `dark`, `light`, `green`, `rainbow`, or `custom` with your own hex colors.

### 2. Theme

- The first time you open it, it downloads every theme from terminalcolors.com to `~/.claude/zen-toolbox/themes/`.
- Moving through the list with the arrow keys or the mouse wheel **previews** each theme on the whole window. **Enter** keeps one. Leaving without keeping one puts your kept theme back.
  - **Windows Terminal:** the theme is written into Windows Terminal's `settings.json` as the default color scheme every profile inherits, so every new window opens in it. Schemes left over from previews are removed. A backup is saved first, as `settings.json.zen-toolbox.bak`, and **Reset** puts its colors back.
  - **macOS / Linux:** the colors are sent to the terminal as OSC sequences, and applied again at each session start. Works in iTerm2, Ghostty, kitty, WezTerm, Alacritty and most modern terminals.
- **Reset** puts your original colors back.

### 3. Mode

- **Effort:** `low` / `medium` / `high` / `xhigh` / `max`. The level the session is using is marked. A level you pick applies to every request from then on, and is remembered.
- **Running in:** the current permission mode. A mod can't switch the mode of a running session, so use **shift+tab** for that.
- **New sessions start in:** ask, plan, accept edits, auto or bypass permissions, each in Claude Code's own color. The current mode is marked **· now**. Your pick is saved as `permissions.defaultMode` in `~/.claude/settings.json` (backed up first).

### 4. Status line

- Row 1: the model, the folder and the git branch.
- Row 2: context, the 5h and 7d limits with their reset times, and the cache state, with **◆ extra-mods** at the end of the same row.
- **● cache ok** (green) while Claude's last response is under an hour old; **● cache over** (red) after that.
- When the terminal narrows, the bars go first, then the reset times.
- **On** takes your own `statusLine` command out of `~/.claude/settings.json` so the two don't stack (backed up first). **Off** puts it back.

`statusline/statusline.py` is the same status line as a standalone script, for Claude Code setups without the mod (see step 5 of the agent instructions).

### 5. Privacy

- Turns on Claude Code's demo mode, which hides your account email and organization name in the header and in `/status`.
- **It applies from your next session.** Claude Code reads the `IS_DEMO` variable once, when it starts, so the session you change it in stays as it was. The page shows both: **New sessions** (the toggle) and **This session** (what's in effect now).
- **On** adds `IS_DEMO=1` to the `env` block of `~/.claude/settings.json` (backed up first).
- **Off** removes it there. On Windows, it also removes the `IS_DEMO` user variable if one was set with `setx`, because any value at all turns demo mode on.

## Develop

```
claude --plugin-dir ./plugins/zen-toolbox
claude plugin validate ./plugins/zen-toolbox
claude plugin test ./plugins/zen-toolbox
```

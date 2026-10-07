# Claude Mods

**English** · [Português](README.pt-BR.md)

Mods for [Claude Code](https://claude.com/claude-code). One plugin, `extra-mods`, adds an **◆ extra-mods ▲** button in the bottom-right corner, under the prompt. It opens a sidebar with four tools:

| Tool | What it does |
|---|---|
| **Zen mode** | Hides tool calls and their output, and shows Claude's plan as a progress band above the prompt |
| **Theme** | Colors Claude Code with any theme from [terminalcolors.com](https://terminalcolors.com), with live preview |
| **Mode** | Sets the effort level, and the permission mode new sessions start in |
| **Status line** | Model, folder, branch, context, 5h/7d limits and cache state, with the button on the same row |

## Install

You need Claude Code 2.1.292 or newer. Run these in a terminal:

```
claude plugin marketplace add Jhonatan-de-Souza/ClaudeMods
claude plugin install extra-mods@jdsjh-mods --scope user
```

Then start a new Claude Code session, or run `/reload-plugins` in an open one. The button shows up at the bottom right of every session.

To update to the latest version later:

```
claude plugin marketplace update jdsjh-mods
claude plugin update extra-mods@jdsjh-mods
```

### Install with an AI agent

You can point your coding agent at this repository and ask it to install the mod. The steps below are written for the agent.

> **Agent instructions.** Follow these steps in order. Ask the user before step 4, because it changes their settings.
>
> 1. Check Claude Code is installed and recent enough: run `claude --version`. It must print 2.1.292 or higher. If it doesn't, stop and tell the user to update Claude Code.
> 2. Add this repository as a plugin marketplace: run `claude plugin marketplace add Jhonatan-de-Souza/ClaudeMods`. It should print `Successfully added marketplace: jdsjh-mods`. If the marketplace already exists, continue.
> 3. Install the plugin for all sessions: run `claude plugin install extra-mods@jdsjh-mods --scope user`. It should print `Successfully installed plugin: extra-mods@jdsjh-mods`.
> 4. *Optional, ask first, and only if the user does not want the mod's built-in status line:* install the standalone status line script. Copy `statusline/statusline.py` from this repository to `~/.claude/statusline.py`. Then in `~/.claude/settings.json` set `"statusLine": { "type": "command", "command": "python ~/.claude/statusline.py", "refreshInterval": 2 }` (use `python3` on macOS and Linux). It needs Python 3.
> 5. Verify: run `claude plugin list`. `extra-mods` must be listed and enabled.
> 6. Tell the user to run `/reload-plugins` or start a new session, then click **◆ extra-mods ▲** at the bottom right, or type `/tools`.
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

> **Tested on Windows only so far** (Windows Terminal). On macOS and Linux the theme colors Claude Code's interface, but the terminal's background isn't changed yet; that part will come once it's tested on a Mac.

- The first time you open it, it downloads every theme from terminalcolors.com to `~/.claude/extra-mods/themes/`.
- Moving through the list with the arrow keys or the mouse wheel **previews** each theme on Claude Code. **Enter** keeps one. Leaving without keeping one puts your kept theme back.
- Each theme becomes a Claude Code custom theme, `~/.claude/themes/extra-mods.json`, and is set as `theme` in `~/.claude/settings.json`. Claude Code reloads it live and remembers it across sessions.
- It sets every color Claude Code's interface has: text, the accent, borders, success/error/warning, the permission modes, diffs, selection, spinners, subagents and your message background.
- A Claude Code theme can't change the terminal's background. **On Windows Terminal**, the mod also puts the theme, background included, on the profile Claude Code runs in, for as long as the session lasts: previews and picks repaint the tab live, and the profile gets its own colors back when the session ends (or, after a crash, when the next one ends). Windows Terminal colors whole profiles, so other open tabs on the same profile take the theme too while Claude Code runs. Windows Terminal's `settings.json` is backed up first, as `settings.json.extra-mods.bak`.
- The first time, restart Claude Code once: it reads the theme setting at startup, and only loads `~/.claude/themes/` when that setting is already a custom theme. After that, picking a theme changes Claude Code live.
- **Back to Claude Code's previous theme** selects the theme you had before, and gives the Windows Terminal profile its own colors back.

### 3. Mode

- **Effort:** `low` / `medium` / `high` / `xhigh` / `max`. The level the session is using is marked. A level you pick applies to every request from then on, and is remembered.
- **Running in:** the current permission mode. A mod can't switch the mode of a running session, so use **shift+tab** for that.
- **New sessions start in:** ask, plan, accept edits, auto or bypass permissions, each in Claude Code's own color. The current mode is marked **· now**. Your pick is saved as `permissions.defaultMode` in `~/.claude/settings.json` (backed up first).

### 4. Status line

- One row, next to Claude Code's own mode label: the model, the folder and the git branch, then context, the 5h and 7d limits with their reset times, and the cache state, with **◆ extra-mods** at the end.
- **● cache ok** (green) while Claude's last response is under an hour old; **● cache over** (red) after that.
- When the terminal narrows, the bars go first, then the reset times, then the model and folder.
- It's **on** by default, so **◆ extra-mods** sits on the status row. **On** takes your own `statusLine` command out of `~/.claude/settings.json` so the two don't stack (backed up first). **Off** puts it back.

`statusline/statusline.py` is the same status line as a standalone script, for Claude Code setups without the mod (see step 4 of the agent instructions).

## Develop

```
claude --plugin-dir ./plugins/extra-mods
claude plugin validate ./plugins/extra-mods
claude plugin test ./plugins/extra-mods
```

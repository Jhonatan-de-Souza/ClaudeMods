#!/usr/bin/env python
"""Claude Code status line: model + dir + branch, then context, 5h/7d rate limits and prompt-cache warmth.

Output fits the terminal width (COLUMNS): segments wrap onto new lines, and details drop only when wrapping is not enough.
"""
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime

# Windows defaults stdin/stdout to cp1252, which mangles UTF-8 JSON input
# (accented paths) and can't encode block chars on output.
sys.stdin.reconfigure(encoding="utf-8")
sys.stdout.reconfigure(encoding="utf-8")

GREEN, YELLOW, RED, CYAN, BOLD, RESET = (
    "\033[32m", "\033[33m", "\033[31m", "\033[36m", "\033[1m", "\033[0m",
)
# 256-color grays instead of "dim" (\033[2m), which is too faint in many themes.
GRAY = "\033[38;5;244m"   # secondary text
TRACK = "\033[38;5;238m"  # empty part of a bar
BAR_WIDTH = 10
# Separator per detail level (full / medium / short); the short level is tighter.
SEPS = [f"  {GRAY}│{RESET}  "] * 2 + [f" {GRAY}│{RESET} "]
# As the terminal narrows, segments wrap onto new lines. Past this many stat
# lines, drop to a less detailed level instead of wrapping further.
MAX_STAT_LINES = 2
ANSI = re.compile(r"\033\[[0-9;]*m")
# Claude Code pads the status line a little; leave room so it never wraps.
MARGIN = 4


def visible_len(s):
    return len(ANSI.sub("", s))


def color_for(pct):
    if pct >= 90:
        return RED
    if pct >= 70:
        return YELLOW
    return GREEN


def bar(pct, color):
    filled = min(pct, 100) * BAR_WIDTH // 100
    return f"{color}{'█' * filled}{TRACK}{'░' * (BAR_WIDTH - filled)}{RESET}"


def num(text, color):
    return f"{BOLD}{color}{text}{RESET}"


def fmt_tokens(n):
    if n >= 1_000_000:
        return f"{n / 1_000_000:.1f}M".replace(".0M", "M")
    if n >= 1000:
        return f"{round(n / 1000)}k"
    return str(n)


def fmt_duration(secs):
    """Short countdown: 45s, 12m, 4h38m, 5d18h."""
    secs = max(0, int(secs))
    if secs < 60:
        return f"{secs}s"
    m = secs // 60
    if m < 60:
        return f"{m}m"
    h, m = divmod(m, 60)
    if h < 24:
        return f"{h}h{m:02d}m"
    d, h = divmod(h, 24)
    return f"{d}d{h:02d}h"


def cache_from_transcript(transcript_path):
    """Fallback for Claude Code < 2.1.251, which doesn't send `prompt_cache`.

    Estimates warmth from the last main-thread API call in the transcript.
    """
    if not transcript_path:
        return None
    try:
        with open(transcript_path, "rb") as f:
            f.seek(0, 2)
            f.seek(max(0, f.tell() - 512 * 1024))
            lines = f.read().decode("utf-8", errors="ignore").splitlines()
    except OSError:
        return None

    last_ts, ttl = None, None
    for raw in reversed(lines):
        if '"assistant"' not in raw:
            continue
        try:
            entry = json.loads(raw)
        except ValueError:
            continue
        if entry.get("type") != "assistant" or entry.get("isSidechain"):
            continue
        usage = (entry.get("message") or {}).get("usage")
        if not usage:
            continue
        if last_ts is None:
            last_ts = entry.get("timestamp")
        # The most recent cache write tells us the TTL. When a request mixes
        # TTLs, the 5m entries sit at the end (the conversation tail), so the
        # bulk of the prefix goes cold after 5 minutes: the short TTL wins.
        creation = usage.get("cache_creation") or {}
        if creation.get("ephemeral_5m_input_tokens"):
            ttl = "5m"
        elif creation.get("ephemeral_1h_input_tokens"):
            ttl = "1h"
        if ttl:
            break
    if not last_ts:
        return None
    try:
        called_at = datetime.fromisoformat(last_ts.replace("Z", "+00:00")).timestamp()
    except ValueError:
        return None
    ttl = ttl or "5m"
    expires_at = called_at + (3600 if ttl == "1h" else 300)
    return {"ttl": ttl, "expires_at": expires_at, "warm": expires_at > time.time()}


def cache_segments(pc):
    """Cache segment at each detail level (most detailed first)."""
    if not pc or pc.get("caching_observed") is False:
        return None
    expires_at = pc.get("expires_at")
    remaining = int(expires_at - time.time()) if expires_at else 0
    # Just whether the cache still holds: a green dot while warm, red once over.
    segment = (
        f"{GREEN}●{RESET} {GRAY}cache ok{RESET}"
        if pc.get("warm") and remaining > 0
        else f"{RED}●{RESET} {GRAY}cache over{RESET}"
    )
    return [segment] * 3


def wrap(parts, width, sep):
    """Pack segments into lines no wider than `width`, like word wrapping."""
    lines, cur = [], ""
    for part in parts:
        candidate = f"{cur}{sep}{part}" if cur else part
        if cur and visible_len(candidate) > width:
            lines.append(cur)
            cur = part
        else:
            cur = candidate
    return lines + [cur] if cur else lines


def layout(segments, width):
    """Most detailed level that fits in MAX_STAT_LINES wrapped lines, else the shortest level wrapped freely."""
    for i, sep in enumerate(SEPS):
        parts = [s[i] for s in segments]
        lines = wrap(parts, width, sep)
        if len(lines) <= MAX_STAT_LINES and all(visible_len(p) <= width for p in parts):
            return lines
    return lines


def truncate(text, n):
    return text if len(text) <= n else text[: max(1, n - 1)] + "…"


data = json.load(sys.stdin)
width = (int(os.environ.get("COLUMNS") or 0) or 120) - MARGIN

# --- line 1: model · dir · branch ---
model = (data.get("model") or {}).get("display_name", "?")
cwd = (data.get("workspace") or {}).get("current_dir", "")
dirname = cwd.rstrip("/\\").split("/")[-1].split("\\")[-1] or cwd

branch = ""
try:
    branch = subprocess.check_output(
        ["git", "-C", cwd, "branch", "--show-current"],
        text=True, stderr=subprocess.DEVNULL,
    ).strip()
except Exception:
    pass

# On narrow terminals, trim the longer of dir/branch until the line fits.
room = width - len(model) - (6 if branch else 3)
while len(dirname) + len(branch) > room and max(len(dirname), len(branch)) > 8:
    if len(dirname) >= len(branch):
        dirname = truncate(dirname, len(dirname) - 1)
    else:
        branch = truncate(branch, len(branch) - 1)

dot = f" {GRAY}·{RESET} "
line1 = f"{CYAN}{model}{RESET}{dot}{dirname}"
if branch:
    line1 += f"{dot}{GREEN}{branch}{RESET}"

# --- line 2: each segment rendered at 3 detail levels ---
segments = []

ctx_window = data.get("context_window") or {}
ctx = int(ctx_window.get("used_percentage") or 0)
c = color_for(ctx)
ctx_used = ctx_window.get("total_input_tokens")
ctx_size = ctx_window.get("context_window_size")
# Used/total tokens stay at every detail level: it's the number that matters most.
tokens = ""
if ctx_used:
    total = f"/{fmt_tokens(ctx_size)}" if ctx_size else ""
    tokens = f" {fmt_tokens(ctx_used)}{GRAY}{total}{RESET}"
segments.append([
    f"ctx {bar(ctx, c)} {num(f'{ctx}%', c)}{tokens}",
    f"ctx {num(f'{ctx}%', c)}{tokens}",
    f"ctx {num(f'{ctx}%', c)}{tokens}",
])

rate_limits = data.get("rate_limits") or {}
for key, label in (("five_hour", "5h"), ("seven_day", "7d")):
    rl = rate_limits.get(key) or {}
    if rl.get("used_percentage") is None:
        continue
    pct = int(rl["used_percentage"])
    c = color_for(pct)
    resets = rl.get("resets_at")
    reset_txt = f" {GRAY}(resets {fmt_duration(int(resets) - time.time())}){RESET}" if resets else ""
    segments.append([
        f"{label} {bar(pct, c)} {num(f'{pct}%', c)}{reset_txt}",
        f"{label} {num(f'{pct}%', c)}{reset_txt}",
        f"{label} {num(f'{pct}%', c)}",
    ])

cache = cache_segments(data.get("prompt_cache") or cache_from_transcript(data.get("transcript_path")))
if cache:
    segments.append(cache)

print("\n".join([line1] + layout(segments, width)), end="")

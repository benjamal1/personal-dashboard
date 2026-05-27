# Personal Dashboard — Project Context

**What this is:** Always-on personal browser start page running as a systemd service on the Dell OptiPlex 3070.

**Access:**
- Local: http://localhost:3000
- Tailscale (Mac): http://100.117.129.30:3000

**Machine:** Dell OptiPlex 3070 (bcjamal-OptiPlex-3070), Ubuntu/Hyprland.

## Stack

- Next.js 14, TypeScript, Tailwind CSS, Inter font
- Runs via systemd: `npm run dev` (hot reload, survives logouts via KillMode=control-group, no login shell)
- No external database — all state persists to JSON files in `data/`

## Views (DashboardShell.tsx)

| View | Nav label | Content |
|------|-----------|---------|
| home | — (BJ button) | SearchBar + Clock + Weather + TodoList |
| tasks | Task tracker | HabitTracker + TodoAnalytics |
| usage | Claudex usage | ClaudexUsage |
| digest | Reading digest | placeholder |

## Features

### Home
| Feature | Files | Notes |
|---------|-------|-------|
| Search bar | app/components/SearchBar.tsx | Auto-focuses on load, DuckDuckGo search, smart URL detection |
| Live clock | app/components/Clock.tsx | Updates every second |
| Local weather | app/components/Weather.tsx | ipapi.co → open-meteo.com, no API key, refreshes every 10 min |
| Weekly todos | app/components/TodoList.tsx, app/api/todos/ | Resets Monday, logs to data/todos.json |

### Tasks
| Feature | Files | Notes |
|---------|-------|-------|
| Habit tracker | app/components/HabitTracker.tsx, app/api/habits/ | 28-day windowed grid, ‹/› arrows pan 7 days, today marker, tiered goals (×N), reorder up/down, delete |
| Todo analytics | app/components/TodoAnalytics.tsx, app/api/todos/history/, app/api/todos/triage/ | Weekly triage (push →/ abandon), stacked bar chart, completion stats |

### Usage
| Feature | Files | Notes |
|---------|-------|-------|
| Claudex usage | app/components/ClaudexUsage.tsx, app/api/usage/, lib/usage.ts | Claude + Codex limits, pace, cost; smart polling (10s when stale → 5min when fresh) |

## Data Files (runtime, gitignored)

| File | Schema | Notes |
|------|--------|-------|
| data/todos.json | `{ currentWeek, todos[], log[] }` | Log entries get triage statuses: done/pushed/abandoned |
| data/habits.json | `{ habits[], completions: { "YYYY-MM-DD": { habitId: count } } }` | count=0..goal; goal=1 is boolean |
| data/usage-cache.json | UsageDashboardPayload | codexbar output, 5-min TTL |

## Design System

- Background: `#111111`
- Style: dark minimal floating text — NO cards, NO borders, NO backgrounds on elements
- Colors: zinc palette (zinc-100 primary, zinc-400 secondary, zinc-600 muted, zinc-700/800 ghost)
- Icons: lucide-react only, strokeWidth={1.5}, no emoji
- Font: Inter, font-light throughout
- Spacing: 4/8px rhythm, generous vertical whitespace

## Key Implementation Notes

- **Habit completions format:** `Record<string, Record<string, number>>` (date → habitId → count). Tiered habits cycle 0→1→...→goal→0 on click.
- **Habit grid:** windowed (28 visible days), pans via ‹/› arrows, future dates supported up to +14 days.
- **Claude usage source:** must be `"source": "cli"` in `~/.codexbar/config.json` — `auto` shows 0% on Linux.
- **Service:** uses `ExecStart=/usr/bin/npm run dev` directly (no `bash -lc`), `KillMode=control-group` to survive user logout.

## API Routes

```
app/api/todos/          GET/POST todos, PATCH toggle, DELETE remove
app/api/todos/history/  GET enriched week history + needsTriage
app/api/todos/triage/   POST apply pushed/abandoned statuses
app/api/habits/         GET all habits + completions, POST add habit
app/api/habits/[id]/    DELETE habit + completions
app/api/habits/completions/  POST toggle/increment completion count
app/api/habits/reorder/ PATCH reorder habits array
app/api/usage/          GET codexbar stats (cached, ?refresh=1 to force)
```

## Service Management

```bash
sudo systemctl restart personal-dashboard   # restart
sudo systemctl status personal-dashboard    # check status
sudo systemctl daemon-reload                # after editing .service file
```

## Claudex Workflow

- Orchestrator: Claude Code (Sonnet 4.6)
- Executor: codex-agent background workers
- New features: dispatch codex-agent with design spec from ui-ux-pro-max skill
- Design system: dark minimal zinc palette, lucide-react icons, font-light

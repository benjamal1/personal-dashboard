# Personal Dashboard — Project Context

**What this is:** Always-on personal browser start page running as a systemd service on the Dell OptiPlex 3070.

**Access:**
- Local: http://localhost:3000
- Tailscale (Mac): http://100.117.129.30:3000

**Machine:** Dell OptiPlex 3070 (bcjamal-OptiPlex-3070), Ubuntu/Hyprland.

## Stack

- Next.js 14, TypeScript, Tailwind CSS, Inter font
- Runs via systemd: `npm run dev` (hot reload)
- No external database — todos persist to `data/todos.json`

## Features

| Feature | Files |
|---------|-------|
| Live clock (date + time) | app/components/Clock.tsx, lib/dateTime.ts |
| Local weather (open-meteo, no API key) | app/components/Weather.tsx, lib/weather.ts |
| Weekly todo list (resets Monday, logged) | app/components/TodoList.tsx, app/api/todos/ |

## Design System

- Background: #111111
- Style: dark minimal floating text — no cards, no borders
- Colors: zinc palette (zinc-100 primary, zinc-400 secondary, zinc-600 muted)
- Icons: lucide-react, strokeWidth 1.5, no emoji
- Font: Inter, font-light throughout

## Service Management

```bash
sudo systemctl restart personal-dashboard   # restart
sudo systemctl status personal-dashboard    # check status
```

## Development

No rebuild needed for edits — hot reload is active. Only run npm install when adding new packages.

## Claudex Workflow

- Orchestrator: Claude Code (Sonnet 4.6)
- Executor: codex-agent background workers
- Planning: superpowers:writing-plans -> docs/plans/
- New features: dispatch codex-agent with design spec from ui-ux-pro-max skill

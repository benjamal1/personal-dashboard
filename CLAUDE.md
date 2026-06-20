# Personal Dashboard — Project Guide

Always-on personal browser start page. Next.js 14 app running as a systemd service on the OptiPlex
3070, served at `http://localhost:3000` (and over Tailscale at `http://100.117.129.30:3000`).

> This is the project kernel. The machine-global rules in `~/CLAUDE.md` still apply; this file adds
> project-specific structure and the **sub-project convention** below. Planning lives in `.planning/`
> (PROJECT.md / REQUIREMENTS.md / ROADMAP.md / STATE.md).

## Stack

- Next.js 14 (App Router), TypeScript, Tailwind CSS, Inter font
- React 18, lucide-react icons, gray-matter (frontmatter parsing)
- Tests: Vitest (`npm test` → `vitest run`)
- No external database — all state persists to JSON files in `data/` (gitignored runtime state)
- Python backend for the reading-digest sub-project (`reading-digest/reading_digest/`)

## Commands

```bash
npm run dev      # dev server, hot reload, 0.0.0.0:3000
npm run build    # production build
npm start        # production server
npm test         # vitest run

sudo systemctl restart personal-dashboard   # restart the live service
sudo systemctl status  personal-dashboard
```

## Layout

```
app/
  components/        UI (DashboardShell, SearchBar, Clock, Weather, TodoList,
                     HabitTracker, TodoAnalytics, ClaudexUsage, ReadingDigest, Digest*)
  api/               route handlers: todos/, habits/, usage/, digest/
lib/                 logic + types: todos, habits, usage, weather, dateTime, digest, digest-shared
  __fixtures__/      test + dev fixtures
data/                runtime JSON state (gitignored): todos.json, habits.json, usage-cache.json
reading-digest/      reading-digest sub-project (see Sub-projects below)
.planning/           GSD planning for the dashboard as a whole
docs/                design docs (docs/superpowers/{plans,specs})
```

## Design System

Dark minimal floating text — NO cards, NO borders, NO backgrounds on elements.

- Background `#111111`; zinc palette (zinc-100 primary, zinc-400 secondary, zinc-600 muted, zinc-700/800 ghost)
- Inter, `font-light` throughout; 4/8px spacing rhythm, generous vertical whitespace
- Icons: lucide-react only, `strokeWidth={1.5}`, no emoji

## Key Implementation Notes

- **Habit completions:** `Record<string, Record<string, number>>` (date → habitId → count). Tiered habits cycle 0→1→…→goal→0 on click. Grid is windowed (28 visible days), pans via ‹/› arrows, supports future dates up to +14 days.
- **Claude usage source:** requires `"source": "cli"` in `~/.codexbar/config.json` — `auto` shows 0% on Linux. Binary path overridable via `CODEXBAR_PATH`.
- **Weather:** location overridable via `NEXT_PUBLIC_WEATHER_{CITY,LATITUDE,LONGITUDE}` env, defaults in `lib/weather.ts`.
- **Service:** `ExecStart=/usr/bin/npm run dev`, `KillMode=control-group` to survive user logout.

---

## Sub-projects

**This repo deviates from standard one-project onboarding.** It is ONE git repo with ONE root
`.planning/` that owns the dashboard as a whole — but each feature substantial enough to be designed
and troubleshot in isolation is treated as a **sub-project** with its own planning docs. This is a
monorepo-style pattern, **not** git submodules: frontend code is coupled into the Next.js app and
cannot leave the repo.

### Convention

- A sub-project lives at `<repo>/<feature>/` (e.g. `reading-digest/`) and owns a `docs/` folder
  with at least `DESIGN.md` and, when there is an active issue, `TROUBLESHOOTING.md`.
- If a sub-project grows enough to warrant full GSD tracking, it gets its own **nested** `.planning/`
  scoped to that subtree. Until then, `docs/` is sufficient — don't create empty planning scaffolding.
- The **root `.planning/`** owns the dashboard as a whole; a sub-project's `.planning/` (if any) owns
  only that feature.
- Frontend code for a sub-project stays woven into the Next.js app (`app/`, `lib/`). The sub-project
  directory holds its docs and any backend (e.g. Python). The index below maps each sub-project to
  BOTH its woven frontend paths and its directory.
- New sub-project checklist: create `<feature>/docs/DESIGN.md`, add a row to the index below, and
  (only if it warrants GSD) `mkdir <feature>/.planning` and run planning scoped there.

### Index

| Sub-project | Frontend (woven into Next.js app) | Backend / dir | Planning docs |
|-------------|-----------------------------------|---------------|---------------|
| **reading-digest** | `app/components/ReadingDigest.tsx` + `Digest{Today,Recent}Section.tsx`, `DigestSubmitBar.tsx`, `DigestJobBlock.tsx`; `app/api/digest/{today,recent,submit}/route.ts`; `lib/digest.ts`, `lib/digest-shared.ts` (+ `lib/digest.test.ts`, `lib/__fixtures__/reading-digest/`) | `reading-digest/` — Python cleaner at `reading-digest/reading_digest/{cleaner,slack}.py` | `reading-digest/docs/{DESIGN,TROUBLESHOOTING}.md`; design history in `docs/superpowers/{plans,specs}/2026-06-09-reading-digest-*` |

# Requirements: Personal Dashboard

**Defined:** 2026-06-18 (onboarded from existing codebase + project-context.md)
**Core Value:** One opinionated start page that surfaces my day at a glance and stays out of the way — fast, dark, keyboard-first, always running.

> Onboarding note: most requirements below are already SHIPPED and in daily use. They are
> recorded so the planning state matches reality. Active items are the forward work.

## Shipped (baseline — validated in daily use)

### Home (HOME)

- [x] **HOME-01**: Search bar auto-focuses, runs DuckDuckGo search with smart URL detection — `app/components/SearchBar.tsx`
- [x] **HOME-02**: Live clock updates every second — `app/components/Clock.tsx`
- [x] **HOME-03**: Local weather via ipapi.co → open-meteo (no API key), 10-min refresh, env-overridable location — `app/components/Weather.tsx`, `lib/weather.ts`
- [x] **HOME-04**: Weekly todos reset Monday, persist to `data/todos.json` — `app/components/TodoList.tsx`, `app/api/todos/`

### Tasks (TASK)

- [x] **TASK-01**: Habit tracker — 28-day windowed grid, ‹/› pan 7 days, today marker, tiered goals (×N), reorder, delete — `app/components/HabitTracker.tsx`, `app/api/habits/`
- [x] **TASK-02**: Habit completions stored as `Record<date, Record<habitId, count>>`; tiered habits cycle 0→goal→0 — `data/habits.json`
- [x] **TASK-03**: Todo analytics — weekly triage (push/abandon), stacked bar chart, completion stats — `app/components/TodoAnalytics.tsx`, `app/api/todos/{history,triage}/`

### Usage (USAGE)

- [x] **USAGE-01**: Claudex usage panel — Claude + Codex limits, pace, cost via `codexbar` CLI, env-overridable path, smart polling (10s stale → 5min fresh) — `app/components/ClaudexUsage.tsx`, `lib/usage.ts`, `app/api/usage/`

### Platform (PLAT)

- [x] **PLAT-01**: File-based persistence in `data/*.json` (gitignored runtime state), no external DB
- [x] **PLAT-02**: Runs as systemd service `personal-dashboard`, survives logout (`KillMode=control-group`)
- [x] **PLAT-03**: Dark-minimal design system — `#111111` bg, zinc palette, Inter font-light, lucide-react icons (strokeWidth 1.5), no cards/borders

## Active (forward work)

### Reading Digest (DIG) — sub-project

- [ ] **DIG-01**: Reading-digest end-to-end stable (ingest → cleaner → `/api/digest/{today,recent}` → `ReadingDigest.tsx`) — see `reading-digest/docs/TROUBLESHOOTING.md`
- [ ] **DIG-02**: n8n pipeline confirmed pointing at in-repo `reading-digest/reading_digest/cleaner.py`; claudex original retired
- [ ] **DIG-03**: `_quarantine.json` history preserved across cleaner runs (orphan notes = review-only flags)

### Integrations (INT)

- [ ] **INT-01**: Nightly Telegram (ClawdeBot) prompt logs habit completions into `data/habits.json` — captured request, not yet built

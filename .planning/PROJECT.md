# Personal Dashboard

## What This Is

An always-on personal browser start page running as a systemd service on the Dell OptiPlex 3070.
A minimal, dark, full-screen Next.js app that replaces the new-tab page with the things actually
used every day: search, clock, local weather, a weekly todo tracker, a habit grid, a Claude/Codex
usage panel, and a reading digest. State persists to JSON files in `data/` — no external database.

Accessed locally (`http://localhost:3000`) and over Tailscale from the Mac
(`http://100.117.129.30:3000`).

## Core Value

One opinionated start page that surfaces my day at a glance and stays out of the way — fast,
dark, keyboard-first, and always running. Each surface (todos, habits, usage, digest) earns its
place; nothing is a generic widget.

## Sub-Projects

This repo is ONE git repo with ONE root `.planning/` (the dashboard as a whole), but each feature
that warrants isolated design/troubleshooting is a **sub-project** with its own planning docs.
See the "## Sub-projects" section of the root `CLAUDE.md` for the convention and the live index.
First sub-project: **reading-digest** (`reading-digest/`).

## Requirements

### Validated (shipped + in daily use)

- [x] Home view: search bar (DuckDuckGo + smart URL detection), live clock, local weather (no API key), weekly todos
- [x] Tasks view: 28-day windowed habit grid (tiered goals, pan/reorder/delete) + todo analytics (weekly triage, charts)
- [x] Usage view: Claudex panel (Claude + Codex limits, pace, cost) via `codexbar` CLI with smart polling
- [x] File-based persistence (`data/*.json`), no external DB
- [x] Runs as a systemd service surviving logout (`KillMode=control-group`)

### Active

- [ ] Reading digest sub-project: stabilize end-to-end (ingest → cleaner → API → UI) — see `reading-digest/docs/TROUBLESHOOTING.md`
- [ ] Verify reading-digest n8n pipeline points at the in-repo `reading-digest/reading_digest/cleaner.py` (not the old claudex path), then retire the claudex original
- [ ] Habit logging from Telegram (nightly ClawdeBot prompt → habits.json) — captured request, not yet built

### Out of Scope

- External database — file-based JSON suffices for a solo single-machine dashboard
- Multi-user / auth — single owner, Tailscale-gated
- Git submodules for sub-projects — frontend code is coupled into the Next.js app; this is monorepo-style, not separate repos
- Full generalization for public use — README documents personalization points; broad genericization is deferred

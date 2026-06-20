# Roadmap: Personal Dashboard

## Overview

This project was onboarded into GSD from an already-running codebase. Phase 0 captures the shipped
baseline (home / tasks / usage views, file persistence, systemd) so the planning state matches
reality. Forward work is feature-scoped: stabilize the reading-digest sub-project, then optional
integrations. Each sub-project (see root `CLAUDE.md` → "## Sub-projects") may carry its own nested
planning; the root roadmap owns the dashboard as a whole.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned work
- Decimal phases (2.1): Urgent insertions (marked INSERTED)
- Phase 0: Pre-existing shipped baseline (recorded, not planned)

- [x] **Phase 0: Shipped Baseline** - Home/Tasks/Usage views, file-based persistence, dark-minimal design system, systemd service — live and in daily use
- [ ] **Phase 1: Reading Digest Stabilization** - The reading-digest sub-project works end-to-end (ingest → cleaner → API → UI) with the n8n pipeline pointed at the in-repo cleaner and the claudex original retired
- [ ] **Phase 2: Integrations (optional)** - Nightly Telegram prompt logs habits into `data/habits.json`

## Phase Details

### Phase 0: Shipped Baseline
**Goal**: The dashboard's core surfaces are live and used daily, recorded so planning matches reality.
**Mode:** baseline (pre-onboarding)
**Depends on**: Nothing
**Requirements**: HOME-01..04, TASK-01..03, USAGE-01, PLAT-01..03
**Success Criteria** (all currently TRUE):
  1. Home, Tasks, and Usage views render and function at `http://localhost:3000`.
  2. Todos, habits, and usage state persist across restarts via `data/*.json`.
  3. The app runs as a systemd service that survives logout.
**Status**: Complete (shipped before onboarding)

### Phase 1: Reading Digest Stabilization
**Goal**: The reading-digest feature reliably surfaces a today + recent digest from real ingested data, with a single canonical cleaner.
**Mode:** fix
**Depends on**: Phase 0
**Requirements**: DIG-01, DIG-02, DIG-03
**Success Criteria** (what must be TRUE):
  1. `/api/digest/today` and `/api/digest/recent` return the expected shape from live data (not fixtures).
  2. The n8n pipeline runs the in-repo `reading-digest/reading_digest/cleaner.py`; the claudex original is retired.
  3. `_quarantine.json` history is preserved across cleaner runs.
**Sub-project planning**: `reading-digest/docs/{DESIGN,TROUBLESHOOTING}.md` (+ nested `.planning/` if it grows to warrant full GSD tracking)
**Note**: Active troubleshooting + n8n verification is tracked as a separate task; this phase establishes the goal.

### Phase 2: Integrations (optional)
**Goal**: Habit completions can be logged from outside the dashboard (nightly Telegram prompt).
**Mode:** feature
**Depends on**: Phase 0
**Requirements**: INT-01
**Success Criteria** (what must be TRUE):
  1. A nightly ClawdeBot prompt asks whether habits were done and writes results into `data/habits.json` in the existing schema.

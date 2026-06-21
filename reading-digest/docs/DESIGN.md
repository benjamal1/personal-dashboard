# Reading Digest — sub-project

A self-contained feature of the personal dashboard: ingests reading material (Slack saves,
notes), cleans/normalizes it, and surfaces a daily + recent digest in the UI.

Carved out as its own planning home so it can be designed, troubleshot, and tracked independently
of the rest of the dashboard.

## Where the code lives (woven into the Next.js app)

| Layer | Path |
|-------|------|
| UI subpage | `app/components/ReadingDigest.tsx` + `DigestTodaySection/DigestRecentSection/DigestSubmitBar/DigestJobBlock.tsx` |
| API routes | `app/api/digest/{today,recent,submit}/route.ts` |
| Backend lib | `lib/digest.ts`, `lib/digest-shared.ts` (+ `lib/digest.test.ts`) |
| Fixtures | `lib/__fixtures__/reading-digest/` |

## Backend — markdown cleaner

The markdown-cleaning preprocessor lives **in this repo** at `reading-digest/reading_digest/cleaner.py`
(+ `slack.py`). It preserves `_quarantine.json` history across runs (orphan notes are review-only
flags, not registry stubs). It is a **manual tool** — nothing automated (n8n or cron) invokes it
(verified 2026-06-20). The in-repo copy is byte-identical to the old `~/projects/claudex` copy;
claudex's copy is referenced only by claudex's own tests/docs and is retired with the claudex
decommission, separately.

## n8n pipeline (single self-contained workflow, Claude-run, fully logged — rebuilt 2026-06-21)

One n8n workflow **"Reading Digest"** (`XxWYMW44t3XvzJaY`, ACTIVE, 53 nodes). It is **self-contained**
— the agent launch/poll is **inlined** as explicit SSH nodes (the shared `seedK8` subworkflow was
dropped for this workflow; it stays for Track A/B). All agent stages run via the n8n-claude-runner
mechanics (tmux+SSH Claude Code session, no Anthropic API), NOT `codex-runner.sh`.

| Trigger | Stages |
|---------|--------|
| Webhook `reading-digest-intake` (per-paper, **async** — responds `queued`) | resolver → note |
| Schedule 5am + Manual | finder → recommender |
| Webhook `reading-digest-refill` | recommender-only (regenerates the queue) |

Each stage = `Build (Code) → SSH Launch → [poll loop: Wait 1m → SSH Poll → IF done? → Bump counter →
IF under max? → loop] → SSH Read Result → (intake stages) HTTP status POST`.

- **Full logging / troubleshooting:** every agent writes a structured `<runDir>/<stage>.result.json`
  (`{stage,status,summary,error}`) + appends to `<runDir>/agent.log`; the Read-Result SSH nodes surface
  these into the n8n exec log (`saveDataSuccessExecution: all`). So a failure shows *why*
  (e.g. `full_text_unavailable`) in both n8n and the dashboard, not just "timeout".
- **Live intake status:** the resolver/note stages POST `{id, stage, state, noteFile, error}` to the
  dashboard `/api/digest/intake/status`. ⚠️ **n8n is a Docker container** — these POSTs use
  `http://host.docker.internal:3000`, NOT `localhost` (which is the container, not the host; localhost
  silently failed until fixed 2026-06-21). SSH nodes are unaffected.
- **Poll loops, not fixed waits:** each stage polls every 1 min up to a counter cap (~20–25). Fast
  papers finish in ~2 min/stage instead of always waiting the full budget (~4 min end-to-end vs ~24).
- **MCP:** finder + resolver get `research.json` (research-gateway + consensus) via the launch
  script's 3rd arg; recommender/note run MCP-less.
- Submit is fire-and-forget per paper; status surfaces in the dashboard Incoming queue (15s poll).

## Recommendation queue + feedback (2026-06-21)

The recommender pre-computes a ranked queue so the dashboard never waits on a Claude run:

- **`_reading_queue.json`** — daily-recommender writes the top ~20 scored papers (item_id, title,
  authors, topics, source, note_relpath, score). `getTodayDigest` reads this (falls back to the
  markdown `## Today` parse until it exists).
- **Instant "next"** — Today pages 3 at a time via a client-side cursor (localStorage, keyed by queue
  date). Advancing is pure client-side; wrapping past the end fires `POST /api/digest/refill`.
- **Refill** — `/api/digest/refill` → n8n webhook `reading-digest-refill` (recommender-only branch in
  workflow `DfgOg5j5eQNteB4g`) regenerates the queue async. The 5am daily run also refills.
- **Feedback** — 👍/👎 per paper → `POST /api/digest/feedback` → `setItemPriority` writes
  `priority: high|low` on the registry item by `item_id`. The recommender already scores priority
  (+0.3 / −0.2), so no prompt-logic change — feedback just nudges the next ranking.

## Intake queue (2026-06-21)

Submitting a paper creates a tracked item, not a fire-and-forget. `data/intake.json` is the
server-side store (`lib/digest-intake.ts`, serialized writes); items persist and stay visible until
cleared.

- `POST /api/digest/submit` takes `inputs[]` (multi-add — paste several, one per line), creates one
  item per input, fires one pipeline run each with its `intakeId`.
- n8n reports progress to `POST /api/digest/intake/status` per stage → the UI's **Incoming** section
  (`DigestIntakeSection`, 15s poll) shows `Resolving → Paper found → Note created / failed`.
- Failed items expose a paste-a-link/PDF **retry** (re-submits); `clear` / `clear done` remove items.
- `POST /api/digest/intake/source` records a corrected source on an item.

Obsidian links use vault name **`BJ's Obsidian Vault`** (env `NEXT_PUBLIC_OBSIDIAN_VAULT`) with **no
`.md`** suffix — required for the link to resolve when clicked from the Mac over Tailscale. Library
**source** shows provenance (`deriveSource`: SILab / Coulombe Lab / Bot / Uploaded / Manual /
Suggested) from `origin` + lab tags, not the file-format `source_kind`.

## Vault data layout (`~/obsidian-vault/Articles and Papers/Reading Digest/`)

**Source of truth (JSON):** `_reading_sources.json` (registry — everything derives from this),
`_reading_topics.json` (topic weights), `_quarantine.json` (cleaner history).

**Live, read by the app:** `Reading Digest.md` `## Today` (← daily-recommender, → `/api/digest/today`)
· `Notes/*.md` (← note-generator, → `/api/digest/recent`).

**Cleaner-generated Obsidian views (not read by the app):** `Reading Sources.md`, `Reading Library.md`,
`Runs/clean-*.md`.

**Agent code:** `_agents/prompts/*.md` (the 4 templates the n8n Build Jobs reference — live/critical),
`_agents/.env` + `config.py`. **Assets:** `PDFS/`.

> ⚠️ These paths are hardcoded across `lib/digest.ts`, `cleaner.py`, the 4 prompt templates, and the
> n8n Build Jobs — do not move them without updating every consumer. Cleanup = subtraction, not reorg.
> (2026-06-20: removed stale `Reading Digest Dashboard.md` / `Reading Inbox.md` /
> `Reading Digest Status Legend.md` — old in-Obsidian dashboards superseded by the Next.js app.)

## Design docs
- `../superpowers/plans/2026-06-09-reading-digest-view.md`
- `../superpowers/specs/2026-06-09-reading-digest-view-design.md`

## Status
Running. Unified n8n workflow live + smoke-tested end-to-end (2026-06-20): arXiv submit →
resolver (research MCP) → vault note, surfaced in dashboard Library. See `TROUBLESHOOTING.md` for
the verification log.

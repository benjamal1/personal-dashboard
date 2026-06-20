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

## n8n pipeline (single workflow, Claude-run — 2026-06-20)

One n8n workflow **"Reading Digest"** (`DfgOg5j5eQNteB4g`) replaces the former
Parent + Daily + Intake trio. All four agent stages run via the **n8n-claude-runner** pattern
(shared `⚙️ Invoke Claude` subworkflow `seedK8FzrL37Wx94` — tmux+SSH Claude Code session, no
Anthropic API), NOT the old `codex-runner.sh exec` (OpenAI-billed).

| Trigger | Stages (each = Build Job → Invoke Claude) |
|---------|--------------------------------------------|
| Webhook `reading-digest-intake` (on-demand, **async** — responds `queued` immediately) | paper-resolver → note-generator |
| Schedule 5am + Manual | paper-finder → daily-recommender |

- Agent prompts read the vault templates at `~/obsidian-vault/Articles and Papers/Reading Digest/_agents/prompts/*.md`; each Build Job points a stage at a run-scoped output file under `/tmp/digest-jobs/<runId>/`.
- **MCP:** finder + resolver get the `research.json` preset (research-gateway + consensus) forwarded through the subworkflow's `mcpPreset` arg; recommender + note-gen run with no MCP (file ops).
- Submit is fire-and-forget: webhook returns `{status:"queued"}` before the ~15-min pipeline; the note surfaces via the UI's 60s Library poll.

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

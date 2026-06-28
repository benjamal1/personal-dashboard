# Reading Digest — Troubleshooting

> Working log for the current issue. Fill in as you investigate.

## Symptom
<!-- what's wrong / what you observe -->

## Data flow (for reference)
ingest (Slack/notes) → [claudex cleaner.py?] → vault/data → `/api/digest/today` + `/api/digest/recent`
→ `lib/digest.ts` → `ReadingDigest.tsx`

## Things to check
- [ ] Is the claudex `reading_digest/cleaner.py` still running (n8n / cron)? Does the dashboard depend on its output?
- [ ] `/api/digest/today` + `/api/digest/recent` returning expected shape? (`lib/digest.ts` types)
- [ ] Fixtures vs live data — is it reading `lib/__fixtures__/` instead of real data?
- [ ] `_quarantine.json` history intact across cleaner runs?

## Findings (2026-06-20)
- The cleaner question is resolved: **no n8n node and no cron runs `cleaner.py`** — it is a manual
  tool. Old n8n pipeline only ran codex agents off the vault prompt templates. In-repo cleaner is
  byte-identical to the claudex copy.
- `/api/digest/recent` returns live data with the expected shape; new intake notes surface as `to_read`.
- Old pipeline ran 3 workflows (Parent + Daily + Intake) on `codex-runner.sh exec` (OpenAI-billed),
  with a synchronous webhook that blocked the dashboard submit for the whole ~15-min pipeline.

## Inline rebuild + full logging (2026-06-21)
- Rebuilt the workflow **self-contained** (`XxWYMW44t3XvzJaY`, renamed "Reading Digest", 53 nodes):
  dropped the shared `seedK8` subworkflow, inlined launch/poll per stage, added structured
  `<stage>.result.json` + `agent.log` write-back, and per-stage status POSTs to the dashboard.
- **GOTCHA — n8n is a Docker container.** The status POSTs first used `http://localhost:3000` and
  silently failed (continueOnFail) — `localhost` inside the container ≠ the host dashboard. Fixed to
  `http://host.docker.internal:3000`. SSH nodes were never affected (they ssh into the host).
- **Fixed waits → poll loops.** Each stage now polls every 1 min up to a counter cap instead of one
  big 10–14 min wait. Smoke test: VGG paper resolved in 2 min, note in 2 min (~4 min vs ~24 before),
  status flowed `queued → resolver/done → note/done`, note landed in the Library, math rendered as
  Obsidian `$...$`.
- `crypto.randomUUID` crash on submit fixed — it needs a secure context (HTTPS/localhost); over plain
  HTTP Tailscale it's undefined. Replaced with a plain id generator.

## "Couldn't resolve / timed out" on manual adds — incl. arXiv (2026-06-28)
- **Symptom:** every manually-added paper (even arXiv, which always has full text) showed
  "Couldn't resolve" in the intake UI; stored error was `timed out`, not `full_text_unavailable`.
- **Root cause (NOT the resolver):** `~/.claude/settings.json` global default model was set to
  `opus[1m]`, so headless launches via `n8n-claude-launch.sh` booted Opus 4.8 1M. That model boots
  too slowly for the launcher's `is_working()` detector, which *also* only matched old spinner words
  (Opus 4.8 prints `Waddling/Blanching/Deliberating`). The launcher decided the submit was dropped,
  killed + relaunched the still-booting session twice (`SSH: Launch Resolver` stderr: *"never showed
  a working indicator after 3 launches"*), so the resolver Claude never ran → job dir never created →
  `SSH: Poll Resolver` returned `pending` 25× → `HTTP: Resolver Timeout` POSTed `state:failed`.
  Evidence: n8n execution `21632` (Jun 26, 26-min run). The resolver agent itself was never the problem.
- **Fix** (`bj-agent-os/orchestration/scripts/n8n-claude-launch.sh`):
  1. `is_working()` now matches version-stable signals (`esc to interrupt`, elapsed-timer `(Ns`, token
     counters) instead of brittle spinner words.
  2. Boot-detection window widened 12s → ~50s so slow 1M boots aren't killed mid-launch.
  3. Launcher pins `--model sonnet` (override per-job via `CLAUDE_RUNNER_MODEL`) so headless jobs use
     Sonnet regardless of the `opus[1m]` global default. `claude_runner.py` shares the script → inherits it.
- **Verified:** real webhook POST → resolver resolved arXiv 1706.03762 in ~2 min (both result files
  written, poll signal matched); isolated launcher test boots Sonnet, fast-detects, no warning.

## Resolution (2026-06-20)
- Consolidated to ONE workflow **"Reading Digest"** (`DfgOg5j5eQNteB4g`); deleted Parent/Daily/Intake.
- All 4 agent stages moved from codex to the **n8n-claude-runner** subworkflow (`seedK8FzrL37Wx94`);
  wired it to forward an `mcpPreset` (research-gateway+consensus for finder/resolver).
- Made intake **async**: webhook responds `queued` immediately; UI (`DigestSubmitBar`) shows a queued
  banner and lets the 60s Library poll surface the note. (commit `ee973fd`)
- **Verified end-to-end:** submitted arXiv 1706.03762 → resolver (research MCP) wrote `paper_record.json`
  → note-generator wrote `Notes/attention-is-all-you-need.md` (`status: to_read`) → appears in the
  dashboard Library. Claude session confirmed running with `--mcp-config research.json`.

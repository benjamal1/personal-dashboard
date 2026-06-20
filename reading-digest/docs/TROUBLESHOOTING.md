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

## Resolution (2026-06-20)
- Consolidated to ONE workflow **"Reading Digest"** (`DfgOg5j5eQNteB4g`); deleted Parent/Daily/Intake.
- All 4 agent stages moved from codex to the **n8n-claude-runner** subworkflow (`seedK8FzrL37Wx94`);
  wired it to forward an `mcpPreset` (research-gateway+consensus for finder/resolver).
- Made intake **async**: webhook responds `queued` immediately; UI (`DigestSubmitBar`) shows a queued
  banner and lets the 60s Library poll surface the note. (commit `ee973fd`)
- **Verified end-to-end:** submitted arXiv 1706.03762 → resolver (research MCP) wrote `paper_record.json`
  → note-generator wrote `Notes/attention-is-all-you-need.md` (`status: to_read`) → appears in the
  dashboard Library. Claude session confirmed running with `--mcp-config research.json`.

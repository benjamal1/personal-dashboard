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

## External dependency (⚠ to resolve)

A markdown-cleaning preprocessor still lives in the **archived claudex** repo:
`~/projects/claudex/reading_digest/cleaner.py` (+ `slack.py` for Slack ingest). It preserves
`_quarantine.json` history across runs (orphan notes are review-only flags, not registry stubs).
**Decision pending:** if this still feeds the dashboard's vault/data, port it into this repo
(e.g. `reading-digest/scripts/`) before claudex is deleted. If `lib/digest.ts` fully replaced it,
it's dead.

## Design docs
- `../superpowers/plans/2026-06-09-reading-digest-view.md`
- `../superpowers/specs/2026-06-09-reading-digest-view-design.md`

## Status
Running, but needs troubleshooting — see `TROUBLESHOOTING.md`.

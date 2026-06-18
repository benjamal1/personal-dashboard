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

## Backend (ported into this repo 2026-06-18)

The markdown-cleaning preprocessor now lives **in this repo** at `reading-digest/reading_digest/cleaner.py` (+ `slack.py`). It preserves
`_quarantine.json` history across runs (orphan notes are review-only flags, not registry stubs).
**Still to verify:** confirm the n8n pipeline points at this copy (not the old claudex path), then the claudex original can go.

## Design docs
- `../superpowers/plans/2026-06-09-reading-digest-view.md`
- `../superpowers/specs/2026-06-09-reading-digest-view-design.md`

## Status
Running, but needs troubleshooting — see `TROUBLESHOOTING.md`.

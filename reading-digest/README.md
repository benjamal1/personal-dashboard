# Reading Digest (sub-project)

Self-contained feature of the personal dashboard. Two halves:

- **Backend (this dir, Python):** ingests + cleans reading material.
  - `reading_digest/cleaner.py` — normalizes digest markdown, rewrites links, preserves
    `_quarantine.json` history across runs (orphan notes are review-only flags, not registry stubs).
  - `reading_digest/slack.py` + `slack_intake.py` — ingest saved Slack messages.
  - `reading_digest_clean.py` — CLI entry for the cleaner.
  - Pure stdlib, no external deps.
- **Frontend (in the Next.js app):** `app/api/digest/{today,recent,submit}/route.ts`,
  `lib/digest.ts` / `lib/digest-shared.ts`, `app/components/ReadingDigest.tsx` (+ Digest* components).

Ported out of the archived `claudex` monorepo (2026-06-18). See `docs/DESIGN.md` and
`docs/TROUBLESHOOTING.md`.

## Run the cleaner
```bash
python3 reading_digest_clean.py --help
python3 slack_intake.py --help
```

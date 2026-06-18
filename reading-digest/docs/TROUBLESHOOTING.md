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

## Findings
<!-- log discoveries here -->

## Resolution
<!-- the fix, once found -->

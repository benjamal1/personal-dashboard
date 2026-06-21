# Reading Digest — UI Audit (2026-06-20)

Audit of the **actual** digest UI. (A prior background-agent audit was discarded — it hallucinated
a different codebase: a non-existent `/digest` route, a `DigestNote {slug,summary}` type, lowercase
vault path, `Send/Check` icons. None of that is real. Findings below are verified against the
real files.)

Real surface: `ReadingDigest.tsx` (polls `refresh()` = today+recent every 60s), `DigestSubmitBar.tsx`
(idle/submitting/queued/error), `DigestTodaySection.tsx`, `DigestRecentSection.tsx`,
`DigestJobBlock.tsx`, `lib/digest.ts` (`getTodayDigest`/`getRecentNotes`/`submitPaper`),
`lib/digest-shared.ts` (`RecentNote`/`isReadStatus`). Types are `TodayDigest`/`DigestPaper`/`RecentNote`.

## Summary

| # | Finding | Severity | File |
|---|---------|----------|------|
| 1 | Async failure is silent — a paper whose resolve fails (or times out) writes no note, so it never appears anywhere; queued banner already cleared. No pending/failed surface | HIGH | end-to-end |
| 2 | No persistent "processing" affordance — after the 8s queued banner, a submitted paper is invisible for the ~15-min resolve window (no note yet → not in Today or Library) | MED | `DigestSubmitBar.tsx`, `ReadingDigest.tsx` |
| 3 | `DigestJobBlock` fake stage timer is now dead — built for the old 20-min synchronous wait; post-async the "submitting" state lasts ~1s so "resolving full text → generating note" + elapsed clock never meaningfully render | MED | `DigestJobBlock.tsx:12,50` |
| 4 | Non-ok GET responses silently ignored — `refresh()` keeps stale/empty state on a 500, no error UI; user can't tell "empty vault" from "backend down" | MED | `ReadingDigest.tsx:25,29` |
| 5 | Submit input has no label (placeholder only); low-contrast helper/empty text (zinc-600/700 on `#111111` ≈3:1, under WCAG AA) | LOW | `DigestSubmitBar.tsx:84,93`, sections |

## Detail

### 1. Silent failure (HIGH)
`submitPaper` → async webhook returns `queued` immediately; the resolver can legitimately fail
(`paper-resolver.md` writes `{"error":"full_text_unavailable"}` and stops → note-generator writes
`{"error":"upstream_failed"}` → **no note file**). The UI only ever learns about a paper when a
note appears in `/api/digest/recent`. So a failed paper vanishes: queued banner gone after 8s,
nothing in Today/Library, no error. User has no idea it failed.
Fix: optimistic pending list (see #2) that, on a timeout threshold, flips to "may have failed —
re-submit?". Longer-term: have note-generator write a stub note with a `failed` status the UI can
group, instead of writing nothing.

### 2. No processing affordance (MED, pairs with #1)
`DigestSubmitBar` clears `queued` after `QUEUED_NOTICE_MS` (8s). For the next ~15 min there's no
evidence the paper is in flight. Lift submitted inputs into a `pending` list owned by
`ReadingDigest` (persist to `sessionStorage` so reload doesn't drop them), render muted rows at the
top of Today labelled "processing", and remove a pending row once a `recent` note matches its
url/title. This is the single highest-value add and also solves #1's visibility.

### 3. Dead stage timer (MED)
`DigestJobBlock.tsx`: `RESOLVING_STAGE_SECONDS = 90` + a 1s `setInterval` flipping
"resolving full text"→"generating note". This was tuned for the old synchronous submit (the block
rendered for the whole pipeline). Now `submitting` resolves in ~1s, so the timer and stage labels
never show. Either repurpose `DigestJobBlock` to drive the #2 pending list off real state, or strip
the timer/stages down to a plain "submitting…" line. Right now it's misleading dead code.

### 4. Silent non-ok GET (MED)
`ReadingDigest.tsx`: `if (todayResponse.ok) setToday(...)` / `if (recentResponse.ok) setRecent(...)`
— a non-ok response is dropped with no error state, leaving the empty-state copy showing. Add a
minimal `error` state set on `!ok`/throw, render a quiet "couldn't reach digest service" line
instead of the empty state.

### 5. A11y / contrast (LOW)
- `DigestSubmitBar` input: placeholder only, add `aria-label="Paper URL or title"`. (Submit button
  already has a `focus-visible:ring` — good; the input has `focus:outline-none` with no replacement,
  but the bottom border gives some affordance.)
- `zinc-600`/`zinc-700` body text (helper line `:93`, empty states, muted hints) is ≈3:1 on
  `#111111` — under AA 4.5:1. Fine for genuinely decorative text; bump anything load-bearing to
  zinc-400/500.
- Today/Library rows are real `<a>` links → keyboard-navigable already. Good.

## Quick wins (smallest diffs)
1. **#4** `setError` on `!ok`/catch in `refresh()` + a one-line error render. (~4 lines)
2. **#3** Replace `DigestJobBlock`'s timer with a plain "submitting…" (it shows ~1s now), or delete the `useEffect`/stage logic. (subtraction)
3. **#5** Add `aria-label` to the submit input. (one attribute)
4. **#2 (scoped)** Keep the queued banner up longer / make it a small persistent "1 processing" counter instead of an 8s auto-clear. (small)

## Resolved (2026-06-21)
- **#1 + #2 + #3** — Added a client-side pending list (`PendingItem` + `reconcilePending` in
  `lib/digest-shared.ts`, sessionStorage-backed in `ReadingDigest`, rendered by new
  `DigestPendingSection`). Submitted papers show a "Processing" row until a newer note lands
  (greedy 1:1 match), then flip to "may have failed" past a 25-min timeout; dismissible. Retired
  `DigestJobBlock` (deleted) and its dead stage timer.
- **#4** — `refresh()` now sets an `error` state on any non-ok/throw and renders a quiet notice.
- **#5** — `aria-label` on the submit input; input/button disabled during submit. (Contrast bump
  left as-is — current zinc usage is on decorative text.)
- Tests: `lib/digest-shared.test.ts` covers `reconcilePending` (match/keep/timeout/greedy/empty).

## Not done (needs a running browser — out of scope for static read)
Live visual-regression screenshots (320/768/1024/1440), Lighthouse/CWV. Run from an interactive
session with the dev server if wanted.

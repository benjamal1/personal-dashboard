# Reading Digest View — Design Spec
**Date:** 2026-06-09  
**Project:** personal-dashboard (Next.js 14, TypeScript, Tailwind, `#111111` dark minimal)

---

## Overview

Add a `ReadingDigest` component to the existing dashboard's `digest` view (already wired in `DashboardShell.tsx` as a placeholder). The view surfaces the reading pipeline without adding any editing surface — all status/tag/feedback edits happen in Obsidian.

---

## Design System

Inherits the existing dashboard system exactly:
- **Background:** `#111111`
- **Style:** dark minimal, no cards, no borders, no backgrounds on elements
- **Colors:** zinc palette — `zinc-100` primary, `zinc-400` secondary, `zinc-600` muted, `zinc-700/800` ghost
- **Icons:** lucide-react only, `strokeWidth={1.5}`
- **Font:** Inter, `font-light` throughout
- **Spacing:** 4/8px rhythm, generous vertical whitespace

---

## Layout

Single-column, three sections from top to bottom:

### 1. Submit Bar
- Text input: `placeholder="https://arxiv.org/abs/… or paper title"`
- Hint line below: `arxiv · pmc · springer · wiley · acs · ieee · doi`  
- `add →` button right-aligned on the input line
- On submit: disables input, transitions to Active Job block

### 2. Active Job Block
- Shows only while a pipeline run is in progress
- Spinner (animated) + paper title + current stage label + elapsed timer (`font-variant-numeric: tabular-nums`)
- Stage labels: `resolving full text` → `generating note` → `done`
- On completion: block fades out, new note appears in Recent section
- On error: block shows error message with a retry link
- Hidden when idle (no padding gap left behind)

### 3. Today — assigned by recommender
- Section label: `Today — {date} · assigned by recommender`
- Source: parse `## Today — YYYY-MM-DD` section from `Reading Digest.md` in the vault
- Shows up to 3 papers
- Each row:
  - **Left:** title (clickable → `obsidian://open?vault=...&file=...`), authors/year/source_kind below, tags below that
  - **Right:** status badge (`to read` / `reading` / `read`), `feedback` badge if set (`more ↑` or `less ↓`)
- All fields read-only; user edits `status`, `tags`, `feedback` in Obsidian

### 4. Recently Added
- Section label: `Recently added`
- Source: list files in `~/obsidian-vault/Articles and Papers/Reading Digest/Notes/`, sorted by mtime, last 10
- Each row: title + source_kind + relative time (`2d ago`)
- Title clickable → opens in Obsidian

---

## Data Sources

| Data | Source | How |
|---|---|---|
| Today's 3 papers | `Reading Digest.md` | Parse `## Today — YYYY-MM-DD` section, extract titles + `[[note_link]]` |
| Note frontmatter (status, tags, feedback) | Individual `.md` files in `Notes/` | Read frontmatter via gray-matter or regex |
| Recent notes | `Notes/` directory | `fs.readdirSync` sorted by mtime |
| Pipeline result | n8n webhook | POST to `http://localhost:5678/webhook/reading-digest-intake` |

All data access is server-side via Next.js API routes — no direct vault reads from browser.

---

## Note Frontmatter Changes

The `note-generator.md` prompt must be updated to include two new fields in every generated note:

```yaml
tags: []           # user adds keywords in Obsidian after reading
feedback: ""       # user sets "more" or "less" in Obsidian; feeds recommender scoring
```

These join the existing fields: `title`, `source`, `source_kind`, `origin`, `status`, `summary_status`, `coverage`, `priority`, `intake_at`.

---

## Feedback → Recommender Loop

The `daily-recommender.md` prompt must be updated to:
1. Scan all notes in `Notes/` for `feedback: "more"` entries → extract their topic keywords → boost papers with overlapping topics (+0.4 per match)
2. Scan for `feedback: "less"` → extract topics → penalise similar candidates (−0.4 per match)

This replaces the removed `manual_rating` field. No star scale — just directional preference signals.

---

## API Routes (new)

| Route | Method | Purpose |
|---|---|---|
| `app/api/digest/today/route.ts` | GET | Parse `Reading Digest.md`, return today's 3 papers with frontmatter |
| `app/api/digest/recent/route.ts` | GET | List 10 most-recent notes from `Notes/` dir |
| `app/api/digest/submit/route.ts` | POST | Proxy URL/title to n8n webhook, stream status, return result |

---

## Component Structure

```
app/components/ReadingDigest.tsx       — main view, composes the three sections
app/components/DigestSubmitBar.tsx     — input + add button, manages submit state
app/components/DigestJobBlock.tsx      — spinner + stage + elapsed timer
app/components/DigestTodaySection.tsx  — today's papers from recommender
app/components/DigestRecentSection.tsx — recent intake list
```

`DashboardShell.tsx`: replace `PlaceholderView` in the digest branch with `<ReadingDigest />`.

---

## Interaction Details

- **Submit flow:** POST → show job block with `resolving full text` → poll or wait for response (~5 min) → fade out job block → refresh recent section
- **Obsidian links:** `obsidian://open?vault=obsidian-vault&file=Articles%20and%20Papers%2FReading%20Digest%2FNotes%2F{filename}`
- **Polling cadence:** frontend polls `/api/digest/today` and `/api/digest/recent` every 60s (cheap — just file reads)
- **Empty states:** "No papers assigned today — daily recommender runs at 5am" / "No notes yet — add a paper above"

---

## Out of Scope (Phase 1)

- Editing status, tags, or feedback from the dashboard (Obsidian only)
- PDF storage or viewing
- Manual override of today's assignment
- Search or filtering within the note list

---

## Phase 2 — Future Considerations

Not built now, but the Phase 1 design should not block these:

### Status editing from dashboard
- Nice-to-have, not necessary — Obsidian remains primary editor.
- If added later: a small `PATCH /api/digest/notes/[file]` route that rewrites frontmatter via gray-matter (read-modify-write the `.md` file directly, since the vault file IS the database).
- UI: inline status dropdown on each row in Today/Recent sections.

### PDF storage
- Current state: `Reading Digest/PDFS/` holds resolved papers' PDFs (confirmed populated, ~20+ files).
- Plan: keep PDFs in the vault (`Reading Digest/PDFS/`) — they're reference-only, no need to move into the dashboard project.
- `paper-resolver.md` should continue saving PDFs there with a filename matching the note's slug, so a future "view PDF" link can be derived as `PDFS/{slug}.pdf` without extra metadata.
- No viewer needed yet — if added later, link out to the PDF file via `obsidian://` or a simple static file route that serves from the vault path.

### Manual override of today's assignment
- Future: a "swap" action on a Today row that lets the user pick a different `to read` candidate from `_reading_sources.json`.
- Would need a new API route to rewrite the `## Today — YYYY-MM-DD` section in `Reading Digest.md`.
- Deferred until the recommender's picks prove unreliable in practice.

### Search/filtering
- Future: a search box over `Notes/` frontmatter (title, tags, topics) for the Recent section once the note count grows large enough to need it.

---

## Vault Cleanup Plan

The vault has leftover files/folders from before the Reading Digest pipeline existed. These are **separate from and do not block** the dashboard work, since the pipeline already writes to the clean `Reading Digest/` structure. Cleanup is vault housekeeping, done independently.

**Confirmed clean structure (keep, no changes):**
- `Articles and Papers/Reading Digest/` — `Notes/`, `PDFS/`, `_agents/`, `_reading_sources.json`, `_reading_topics.json`, `Reading Digest.md`

**Legacy items at `Articles and Papers/` root (candidates for archive/removal):**
- Loose `.md` paper notes duplicated in `Reading Digest/Notes/` (e.g. `2602-13633.md`, `AIxSuture-...md`, `echojepa-...md`, `medos-ai-xr-cobot-...md`, `Silverman et al...md`, `Rupert et al...md`, `Why AI Hallucinates...md`, etc.)
- `PDFs/` (root, capital P) — overlaps heavily with `Reading Digest/PDFS/`; check for unique files before removing
- Old planning stubs: `Reading Digest Dashboard.md`, `Reading Inbox.md`, `Reading Library.md`, `Reading Sources.md`, `Reading Digest Status Legend.md`, `To Read.md` — these predate `Reading Digest.md`/`_reading_sources.json` and are mostly empty/legacy pointers
- Project folders unrelated to the digest: `CardioEngineering Final Project/`, `Surgical Intuition Lit Search/`, `david-kalfa.md`, and other root-level papers not part of the reading pipeline

**Approach:**
1. Move (don't delete) legacy items into `Articles and Papers/_archive/` in one batch — reversible, keeps vault searchable history intact.
2. Diff `PDFs/` (root) against `Reading Digest/PDFS/` — anything not duplicated moves to `Reading Digest/PDFS/`, the rest archives.
3. Leave non-digest project folders (`CardioEngineering Final Project/`, `Surgical Intuition Lit Search/`) alone — out of scope, not digest-related.
4. Do this as a separate step after the dashboard build, since it touches the vault (outside the dashboard project) and needs explicit confirmation before moving files.

---

## File Locations

- Vault path: `~/obsidian-vault/Articles and Papers/Reading Digest/`
- Notes dir: `.../Notes/`
- Registry: `_reading_sources.json`
- Today file: `Reading Digest.md`
- Prompts: `_agents/prompts/`

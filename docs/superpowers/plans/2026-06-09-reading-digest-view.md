# Reading Digest View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `ReadingDigest` view to the personal dashboard that shows today's recommended papers, recently added notes, and a submit bar to add new papers to the n8n reading-digest pipeline.

**Architecture:** Server-side `lib/digest.ts` reads/parses the Obsidian vault (`Reading Digest.md` + `Notes/*.md` frontmatter) and proxies pipeline submissions to the n8n webhook. Three Next.js API routes (`/api/digest/today`, `/api/digest/recent`, `/api/digest/submit`) expose this to a client-side `ReadingDigest` component, which replaces the `digest` placeholder in `DashboardShell.tsx`.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind, vitest, `gray-matter` for frontmatter parsing.

---

## Reference: Spec

Full design spec: `docs/superpowers/specs/2026-06-09-reading-digest-view-design.md`

## Reference: Vault data shapes

`~/obsidian-vault/Articles and Papers/Reading Digest/Reading Digest.md` contains a section like:

```markdown
## Today — 2026-06-08

### Cardiac tissue engineering: an emerging approach to the treatment of heart failure
**Authors:** Pisheh et al.  
**Added:** 2026-05-02  
**Topics:** Cardiac Tissue Engineering, Cardiovascular Biology  
[[Pisheh - Cardiac tissue engineering: an emerging approach to the]]

### MedOS AI XR Cobot World Model for Clinical
**Authors:** Unknown  
**Added:** 2026-05-02  
**Topics:** Machine Learning  
[[MedOS AI XR Cobot World Model for Clinical]]
```

Each `[[wikilink]]` is a note filename (without `.md`) in `~/obsidian-vault/Articles and Papers/Reading Digest/Notes/`.

Note frontmatter (`Notes/mistral-7b.md`):

```yaml
---
title: "Mistral 7B"
source: "https://arxiv.org/abs/2310.06825"
source_kind: "arxiv"
origin: "n8n-intake"
status: "to read"
summary_status: "generated"
coverage: "full"
priority: "normal"
intake_at: "2026-06-08T04:15:44Z"
---
```

After Task 14, new notes will also have `tags: []` and `feedback: ""`. Existing notes won't have these fields yet — code must treat them as optional (default to `[]` and `null`/`""`).

---

## File Structure

- `lib/digest.ts` — types, vault parsing (`parseTodaySection`, `getTodayDigest`, `getRecentNotes`), pipeline submission (`submitPaper`)
- `lib/digest.test.ts` — unit tests, using fixture files under `lib/__fixtures__/reading-digest/`
- `lib/__fixtures__/reading-digest/Reading Digest.md` — fixture vault file
- `lib/__fixtures__/reading-digest/Notes/*.md` — fixture notes
- `app/api/digest/today/route.ts` — GET today's papers
- `app/api/digest/recent/route.ts` — GET recent notes
- `app/api/digest/submit/route.ts` — POST new paper to n8n webhook
- `app/components/ReadingDigest.tsx` — main view, composes sections, polling
- `app/components/DigestSubmitBar.tsx` — input + submit
- `app/components/DigestJobBlock.tsx` — active job spinner/timer
- `app/components/DigestTodaySection.tsx` — today's papers list
- `app/components/DigestRecentSection.tsx` — recent notes list
- `app/components/DashboardShell.tsx` — modify digest branch (existing file)
- `~/obsidian-vault/Articles and Papers/Reading Digest/_agents/prompts/note-generator.md` — modify (vault, outside project — Task 14 requires confirmation before editing)
- `~/obsidian-vault/Articles and Papers/Reading Digest/_agents/prompts/daily-recommender.md` — modify (vault, outside project — Task 14 requires confirmation before editing)

---

## Task 1: Add gray-matter dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install gray-matter**

```bash
npm install gray-matter
```

- [ ] **Step 2: Verify it's in package.json dependencies**

Run: `grep gray-matter package.json`
Expected: a line like `"gray-matter": "^4.0.3"` under `dependencies`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add gray-matter for frontmatter parsing"
```

---

## Task 2: `parseTodaySection` — parse the Today section from Reading Digest.md

**Files:**
- Create: `lib/digest.ts`
- Create: `lib/digest.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/digest.test.ts`:

```typescript
import { describe, expect, it } from "vitest";

import { parseTodaySection } from "./digest";

const SAMPLE_DIGEST = `# Reading Digest

> [!info] Main entry points
> The dashboard is primary.

## Workflows
- Open the dashboard: [[Reading Digest Dashboard]]

## Today — 2026-06-08

### Cardiac tissue engineering: an emerging approach to the treatment of heart failure
**Authors:** Pisheh et al.  
**Added:** 2026-05-02  
**Topics:** Cardiac Tissue Engineering, Cardiovascular Biology  
[[Pisheh - Cardiac tissue engineering: an emerging approach to the]]

### MedOS AI XR Cobot World Model for Clinical
**Authors:** Unknown  
**Added:** 2026-05-02  
**Topics:** Machine Learning  
[[MedOS AI XR Cobot World Model for Clinical]]
`;

describe("parseTodaySection", () => {
  it("extracts the date and each paper entry", () => {
    const result = parseTodaySection(SAMPLE_DIGEST);

    expect(result.date).toBe("2026-06-08");
    expect(result.entries).toHaveLength(2);
  });

  it("extracts title, authors, added date, topics, and note file for each entry", () => {
    const result = parseTodaySection(SAMPLE_DIGEST);
    const [first] = result.entries;

    expect(first.title).toBe(
      "Cardiac tissue engineering: an emerging approach to the treatment of heart failure"
    );
    expect(first.authors).toBe("Pisheh et al.");
    expect(first.added).toBe("2026-05-02");
    expect(first.topics).toEqual(["Cardiac Tissue Engineering", "Cardiovascular Biology"]);
    expect(first.noteFile).toBe("Pisheh - Cardiac tissue engineering: an emerging approach to the");
  });

  it("returns an empty entries array and null date when there is no Today section", () => {
    const result = parseTodaySection("# Reading Digest\n\nNo today section here.\n");

    expect(result.date).toBeNull();
    expect(result.entries).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/digest.test.ts`
Expected: FAIL — `lib/digest.ts` does not exist / `parseTodaySection` is not exported.

- [ ] **Step 3: Write minimal implementation**

Create `lib/digest.ts`:

```typescript
export type TodayEntry = {
  title: string;
  authors: string;
  added: string;
  topics: string[];
  noteFile: string | null;
};

export type TodaySection = {
  date: string | null;
  entries: TodayEntry[];
};

const TODAY_HEADER_RE = /^## Today — (\d{4}-\d{2}-\d{2})\s*$/m;
const ENTRY_HEADER_RE = /^### (.+)$/;
const FIELD_RE = /^\*\*(\w+):\*\* (.+?)\s*$/;
const WIKILINK_RE = /^\[\[(.+)\]\]$/;

export function parseTodaySection(markdown: string): TodaySection {
  const headerMatch = markdown.match(TODAY_HEADER_RE);

  if (!headerMatch) {
    return { date: null, entries: [] };
  }

  const sectionStart = headerMatch.index! + headerMatch[0].length;
  const rest = markdown.slice(sectionStart);
  const sectionEnd = rest.search(/^## /m);
  const sectionBody = sectionEnd === -1 ? rest : rest.slice(0, sectionEnd);

  const entries: TodayEntry[] = [];
  let current: Partial<TodayEntry> | null = null;

  for (const rawLine of sectionBody.split("\n")) {
    const line = rawLine.trim();

    const entryMatch = line.match(ENTRY_HEADER_RE);
    if (entryMatch) {
      if (current) {
        entries.push(finalizeEntry(current));
      }
      current = { title: entryMatch[1].trim() };
      continue;
    }

    if (!current) {
      continue;
    }

    const fieldMatch = line.match(FIELD_RE);
    if (fieldMatch) {
      const [, field, value] = fieldMatch;
      if (field === "Authors") {
        current.authors = value;
      } else if (field === "Added") {
        current.added = value;
      } else if (field === "Topics") {
        current.topics = value.split(",").map((topic) => topic.trim());
      }
      continue;
    }

    const linkMatch = line.match(WIKILINK_RE);
    if (linkMatch) {
      current.noteFile = linkMatch[1];
    }
  }

  if (current) {
    entries.push(finalizeEntry(current));
  }

  return { date: headerMatch[1], entries };
}

function finalizeEntry(entry: Partial<TodayEntry>): TodayEntry {
  return {
    title: entry.title ?? "",
    authors: entry.authors ?? "Unknown",
    added: entry.added ?? "",
    topics: entry.topics ?? [],
    noteFile: entry.noteFile ?? null
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/digest.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/digest.ts lib/digest.test.ts
git commit -m "feat: parse Today section from Reading Digest.md"
```

---

## Task 3: `getTodayDigest` — combine Today section with note frontmatter

**Files:**
- Modify: `lib/digest.ts`
- Modify: `lib/digest.test.ts`
- Create: `lib/__fixtures__/reading-digest/Reading Digest.md`
- Create: `lib/__fixtures__/reading-digest/Notes/pisheh-cardiac.md`
- Create: `lib/__fixtures__/reading-digest/Notes/medos-cobot.md`

- [ ] **Step 1: Create fixture vault files**

Create `lib/__fixtures__/reading-digest/Reading Digest.md`:

```markdown
# Reading Digest

## Today — 2026-06-08

### Cardiac tissue engineering: an emerging approach to the treatment of heart failure
**Authors:** Pisheh et al.  
**Added:** 2026-05-02  
**Topics:** Cardiac Tissue Engineering, Cardiovascular Biology  
[[pisheh-cardiac]]

### MedOS AI XR Cobot World Model for Clinical
**Authors:** Unknown  
**Added:** 2026-05-02  
**Topics:** Machine Learning  
[[medos-cobot]]
```

Create `lib/__fixtures__/reading-digest/Notes/pisheh-cardiac.md`:

```markdown
---
title: "Cardiac tissue engineering: an emerging approach to the treatment of heart failure"
source: "https://example.com/pisheh"
source_kind: "journal"
origin: "n8n-intake"
status: "to read"
summary_status: "generated"
coverage: "full"
priority: "normal"
intake_at: "2026-05-02T00:00:00Z"
tags: ["cardiac", "tissue-engineering"]
feedback: "more"
---

# Cardiac tissue engineering
```

Create `lib/__fixtures__/reading-digest/Notes/medos-cobot.md`:

```markdown
---
title: "MedOS AI XR Cobot World Model for Clinical"
source: "https://example.com/medos"
source_kind: "preprint"
origin: "n8n-intake"
status: "reading"
summary_status: "generated"
coverage: "full"
priority: "normal"
intake_at: "2026-05-02T00:00:00Z"
---

# MedOS AI XR Cobot
```

Note: `medos-cobot.md` intentionally has no `tags`/`feedback` fields, to test the optional-field fallback for notes generated before Task 14.

- [ ] **Step 2: Write the failing test**

Append to `lib/digest.test.ts`:

```typescript
import { join } from "node:path";

import { getTodayDigest } from "./digest";

const FIXTURE_VAULT_DIR = join(__dirname, "__fixtures__", "reading-digest");

describe("getTodayDigest", () => {
  it("merges Today entries with note frontmatter", async () => {
    const digest = await getTodayDigest(FIXTURE_VAULT_DIR);

    expect(digest.date).toBe("2026-06-08");
    expect(digest.papers).toHaveLength(2);

    const [pisheh, medos] = digest.papers;

    expect(pisheh.title).toBe(
      "Cardiac tissue engineering: an emerging approach to the treatment of heart failure"
    );
    expect(pisheh.status).toBe("to read");
    expect(pisheh.tags).toEqual(["cardiac", "tissue-engineering"]);
    expect(pisheh.feedback).toBe("more");
    expect(pisheh.noteFile).toBe("pisheh-cardiac");

    expect(medos.status).toBe("reading");
    expect(medos.tags).toEqual([]);
    expect(medos.feedback).toBeNull();
  });

  it("returns empty papers when no Today section exists", async () => {
    const digest = await getTodayDigest(join(FIXTURE_VAULT_DIR, "does-not-exist"));

    expect(digest.date).toBeNull();
    expect(digest.papers).toEqual([]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run lib/digest.test.ts`
Expected: FAIL — `getTodayDigest` is not exported.

- [ ] **Step 4: Write minimal implementation**

Add to `lib/digest.ts` (append, keep existing exports):

```typescript
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

import matter from "gray-matter";

export type DigestPaper = TodayEntry & {
  status: string | null;
  tags: string[];
  feedback: string | null;
};

export type TodayDigest = {
  date: string | null;
  papers: DigestPaper[];
};

export async function getTodayDigest(vaultDir: string): Promise<TodayDigest> {
  const digestPath = join(vaultDir, "Reading Digest.md");

  let raw: string;
  try {
    raw = await readFile(digestPath, "utf-8");
  } catch {
    return { date: null, papers: [] };
  }

  const section = parseTodaySection(raw);

  const papers = await Promise.all(
    section.entries.map(async (entry) => {
      const frontmatter = entry.noteFile
        ? await readNoteFrontmatter(join(vaultDir, "Notes", `${entry.noteFile}.md`))
        : null;

      return {
        ...entry,
        status: frontmatter?.status ?? null,
        tags: frontmatter?.tags ?? [],
        feedback: frontmatter?.feedback ?? null
      };
    })
  );

  return { date: section.date, papers };
}

type NoteFrontmatter = {
  status: string | null;
  tags: string[];
  feedback: string | null;
  title: string | null;
  sourceKind: string | null;
  intakeAt: string | null;
};

export async function readNoteFrontmatter(filePath: string): Promise<NoteFrontmatter | null> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf-8");
  } catch {
    return null;
  }

  const { data } = matter(raw);

  return {
    status: typeof data.status === "string" ? data.status : null,
    tags: Array.isArray(data.tags) ? data.tags.filter((tag): tag is string => typeof tag === "string") : [],
    feedback: typeof data.feedback === "string" && data.feedback.length > 0 ? data.feedback : null,
    title: typeof data.title === "string" ? data.title : null,
    sourceKind: typeof data.source_kind === "string" ? data.source_kind : null,
    intakeAt: typeof data.intake_at === "string" ? data.intake_at : null
  };
}
```

`readdir` and `stat` imports are unused for now but will be used by Task 4 — leave them in this import statement so Task 4's diff is additive (TypeScript will not error on unused named imports from `node:fs/promises` since they're re-exported types... actually it will warn). Remove `readdir, stat` from this import for now and add them in Task 4 instead, to avoid an unused-import lint error.

Corrected import line for this task:

```typescript
import { readFile } from "node:fs/promises";
import { join } from "node:path";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run lib/digest.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add lib/digest.ts lib/digest.test.ts lib/__fixtures__
git commit -m "feat: merge Today section with note frontmatter"
```

---

## Task 4: `getRecentNotes` — list recently added notes

**Files:**
- Modify: `lib/digest.ts`
- Modify: `lib/digest.test.ts`
- Create: `lib/__fixtures__/reading-digest/Notes/older-note.md`

- [ ] **Step 1: Create an additional fixture note with an older mtime**

Create `lib/__fixtures__/reading-digest/Notes/older-note.md`:

```markdown
---
title: "An Older Paper"
source: "https://example.com/older"
source_kind: "arxiv"
origin: "n8n-intake"
status: "read"
summary_status: "generated"
coverage: "full"
priority: "normal"
intake_at: "2026-01-01T00:00:00Z"
tags: []
feedback: ""
---

# An Older Paper
```

- [ ] **Step 2: Write the failing test**

Append to `lib/digest.test.ts`:

```typescript
import { utimes } from "node:fs/promises";

import { getRecentNotes } from "./digest";

describe("getRecentNotes", () => {
  it("returns notes sorted by most-recently-modified first, limited to N", async () => {
    const notesDir = join(FIXTURE_VAULT_DIR, "Notes");

    // Make older-note.md clearly older than the others
    const oldDate = new Date("2026-01-01T00:00:00Z");
    const recentDate = new Date("2026-06-08T00:00:00Z");
    await utimes(join(notesDir, "older-note.md"), oldDate, oldDate);
    await utimes(join(notesDir, "pisheh-cardiac.md"), recentDate, recentDate);
    await utimes(join(notesDir, "medos-cobot.md"), recentDate, recentDate);

    const notes = await getRecentNotes(FIXTURE_VAULT_DIR, 2);

    expect(notes).toHaveLength(2);
    expect(notes.map((note) => note.fileName)).not.toContain("older-note");
  });

  it("includes title, sourceKind, and fileName for each note", async () => {
    const notes = await getRecentNotes(FIXTURE_VAULT_DIR, 10);
    const pisheh = notes.find((note) => note.fileName === "pisheh-cardiac");

    expect(pisheh).toBeDefined();
    expect(pisheh?.title).toBe(
      "Cardiac tissue engineering: an emerging approach to the treatment of heart failure"
    );
    expect(pisheh?.sourceKind).toBe("journal");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run lib/digest.test.ts`
Expected: FAIL — `getRecentNotes` is not exported.

- [ ] **Step 4: Write minimal implementation**

In `lib/digest.ts`, change the fs import to include `readdir` and `stat`:

```typescript
import { readFile, readdir, stat } from "node:fs/promises";
```

Append:

```typescript
export type RecentNote = {
  fileName: string;
  title: string;
  sourceKind: string | null;
  intakeAt: string | null;
  mtimeMs: number;
};

export async function getRecentNotes(vaultDir: string, limit: number): Promise<RecentNote[]> {
  const notesDir = join(vaultDir, "Notes");

  let fileNames: string[];
  try {
    fileNames = (await readdir(notesDir)).filter((name) => name.endsWith(".md"));
  } catch {
    return [];
  }

  const notes = await Promise.all(
    fileNames.map(async (fileName) => {
      const filePath = join(notesDir, fileName);
      const [stats, frontmatter] = await Promise.all([stat(filePath), readNoteFrontmatter(filePath)]);

      return {
        fileName: fileName.replace(/\.md$/, ""),
        title: frontmatter?.title ?? fileName.replace(/\.md$/, ""),
        sourceKind: frontmatter?.sourceKind ?? null,
        intakeAt: frontmatter?.intakeAt ?? null,
        mtimeMs: stats.mtimeMs
      };
    })
  );

  return notes.sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, limit);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run lib/digest.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 6: Commit**

```bash
git add lib/digest.ts lib/digest.test.ts lib/__fixtures__
git commit -m "feat: list recently added reading-digest notes"
```

---

## Task 5: `/api/digest/today` route

**Files:**
- Create: `app/api/digest/today/route.ts`
- Create: `app/api/digest/today/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `app/api/digest/today/route.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/digest", () => ({
  getTodayDigest: vi.fn(async () => ({
    date: "2026-06-08",
    papers: [
      {
        title: "Sample Paper",
        authors: "Someone",
        added: "2026-06-01",
        topics: ["Topic A"],
        noteFile: "sample-paper",
        status: "to read",
        tags: [],
        feedback: null
      }
    ]
  }))
}));

import { GET } from "./route";

describe("GET /api/digest/today", () => {
  it("returns the today digest as JSON", async () => {
    const response = await GET();
    const body = await response.json();

    expect(body.date).toBe("2026-06-08");
    expect(body.papers).toHaveLength(1);
    expect(body.papers[0].title).toBe("Sample Paper");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/digest/today/route.test.ts`
Expected: FAIL — `app/api/digest/today/route.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `app/api/digest/today/route.ts`:

```typescript
import { homedir } from "node:os";
import { join } from "node:path";

import { NextResponse } from "next/server";

import { getTodayDigest } from "@/lib/digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VAULT_DIGEST_DIR =
  process.env.READING_DIGEST_VAULT_DIR ??
  join(homedir(), "obsidian-vault", "Articles and Papers", "Reading Digest");

export async function GET() {
  const digest = await getTodayDigest(VAULT_DIGEST_DIR);

  return NextResponse.json(digest);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/digest/today/route.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/digest/today
git commit -m "feat: add /api/digest/today route"
```

---

## Task 6: `/api/digest/recent` route

**Files:**
- Create: `app/api/digest/recent/route.ts`
- Create: `app/api/digest/recent/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `app/api/digest/recent/route.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/digest", () => ({
  getRecentNotes: vi.fn(async () => [
    {
      fileName: "sample-paper",
      title: "Sample Paper",
      sourceKind: "arxiv",
      intakeAt: "2026-06-08T00:00:00Z",
      mtimeMs: 1_000_000
    }
  ])
}));

import { GET } from "./route";

describe("GET /api/digest/recent", () => {
  it("returns up to 10 recent notes as JSON", async () => {
    const response = await GET();
    const body = await response.json();

    expect(body.notes).toHaveLength(1);
    expect(body.notes[0].fileName).toBe("sample-paper");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/digest/recent/route.test.ts`
Expected: FAIL — `app/api/digest/recent/route.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `app/api/digest/recent/route.ts`:

```typescript
import { homedir } from "node:os";
import { join } from "node:path";

import { NextResponse } from "next/server";

import { getRecentNotes } from "@/lib/digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VAULT_DIGEST_DIR =
  process.env.READING_DIGEST_VAULT_DIR ??
  join(homedir(), "obsidian-vault", "Articles and Papers", "Reading Digest");

const RECENT_NOTES_LIMIT = 10;

export async function GET() {
  const notes = await getRecentNotes(VAULT_DIGEST_DIR, RECENT_NOTES_LIMIT);

  return NextResponse.json({ notes });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/digest/recent/route.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/api/digest/recent
git commit -m "feat: add /api/digest/recent route"
```

---

## Task 7: `submitPaper` + `/api/digest/submit` route

**Files:**
- Modify: `lib/digest.ts`
- Modify: `lib/digest.test.ts`
- Create: `app/api/digest/submit/route.ts`
- Create: `app/api/digest/submit/route.test.ts`

- [ ] **Step 1: Write the failing test for `submitPaper`**

Append to `lib/digest.test.ts`:

```typescript
import { submitPaper } from "./digest";

describe("submitPaper", () => {
  it("posts the input to the given webhook URL and returns the parsed JSON response", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ status: "ok", title: "Sample Paper" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await submitPaper("https://webhook.example/intake", "https://arxiv.org/abs/1234.5678");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://webhook.example/intake",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
        body: JSON.stringify({ input: "https://arxiv.org/abs/1234.5678" })
      })
    );
    expect(result).toEqual({ status: "ok", title: "Sample Paper" });

    vi.unstubAllGlobals();
  });

  it("throws when the webhook responds with a non-OK status", async () => {
    const fetchMock = vi.fn(async () => new Response("error", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(submitPaper("https://webhook.example/intake", "bad input")).rejects.toThrow(
      "Reading digest webhook returned 500"
    );

    vi.unstubAllGlobals();
  });
});
```

Add `vi` to the existing `vitest` import at the top of `lib/digest.test.ts` if not already present (`import { describe, expect, it, vi } from "vitest";`).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/digest.test.ts`
Expected: FAIL — `submitPaper` is not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `lib/digest.ts`:

```typescript
export async function submitPaper(webhookUrl: string, input: string): Promise<unknown> {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input })
  });

  if (!response.ok) {
    throw new Error(`Reading digest webhook returned ${response.status}`);
  }

  return response.json();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/digest.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Write the failing test for the route**

Create `app/api/digest/submit/route.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/digest", () => ({
  submitPaper: vi.fn(async (_url: string, input: string) => ({ status: "ok", input }))
}));

import { submitPaper } from "@/lib/digest";
import { POST } from "./route";

describe("POST /api/digest/submit", () => {
  it("forwards the input field to submitPaper and returns its result", async () => {
    const request = new Request("http://localhost/api/digest/submit", {
      method: "POST",
      body: JSON.stringify({ input: "https://arxiv.org/abs/1234.5678" }),
      headers: { "Content-Type": "application/json" }
    });

    const response = await POST(request);
    const body = await response.json();

    expect(submitPaper).toHaveBeenCalledWith(expect.any(String), "https://arxiv.org/abs/1234.5678");
    expect(body).toEqual({ status: "ok", input: "https://arxiv.org/abs/1234.5678" });
  });

  it("returns 400 when input is missing or empty", async () => {
    const request = new Request("http://localhost/api/digest/submit", {
      method: "POST",
      body: JSON.stringify({ input: "  " }),
      headers: { "Content-Type": "application/json" }
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("returns 502 when submitPaper throws", async () => {
    vi.mocked(submitPaper).mockRejectedValueOnce(new Error("Reading digest webhook returned 500"));

    const request = new Request("http://localhost/api/digest/submit", {
      method: "POST",
      body: JSON.stringify({ input: "https://arxiv.org/abs/1234.5678" }),
      headers: { "Content-Type": "application/json" }
    });

    const response = await POST(request);

    expect(response.status).toBe(502);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run app/api/digest/submit/route.test.ts`
Expected: FAIL — `app/api/digest/submit/route.ts` does not exist.

- [ ] **Step 7: Write minimal implementation**

Create `app/api/digest/submit/route.ts`:

```typescript
import { NextResponse } from "next/server";

import { submitPaper } from "@/lib/digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WEBHOOK_URL =
  process.env.READING_DIGEST_WEBHOOK_URL ?? "http://localhost:5678/webhook/reading-digest-intake";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected error";
}

export async function POST(request: Request) {
  const body = await request.json();
  const input = typeof body?.input === "string" ? body.input.trim() : "";

  if (!input) {
    return NextResponse.json({ error: "Missing 'input' field" }, { status: 400 });
  }

  try {
    const result = await submitPaper(WEBHOOK_URL, input);
    return NextResponse.json(result);
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 502 });
  }
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run app/api/digest/submit/route.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 9: Commit**

```bash
git add lib/digest.ts lib/digest.test.ts app/api/digest/submit
git commit -m "feat: add /api/digest/submit route proxying to n8n webhook"
```

---

## Task 8: `DigestTodaySection` component

**Files:**
- Create: `app/components/DigestTodaySection.tsx`

This component is presentational — it receives data as props (fetched by the parent `ReadingDigest`). No new test file; covered by manual browser verification in Task 12 plus existing project convention of not unit-testing presentational components (see `app/components/HabitTracker.tsx` etc. for precedent — presentational components in this repo don't have `.test.tsx` files; only `lib/*.ts` does).

- [ ] **Step 1: Create the component**

Create `app/components/DigestTodaySection.tsx`:

```typescript
import type { DigestPaper } from "@/lib/digest";

type DigestTodaySectionProps = {
  date: string | null;
  papers: DigestPaper[];
  vaultName: string;
};

const VAULT_NOTES_PATH = "Articles and Papers/Reading Digest/Notes";

function obsidianLink(vaultName: string, noteFile: string): string {
  const filePath = `${VAULT_NOTES_PATH}/${noteFile}.md`;
  return `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(filePath)}`;
}

function FeedbackBadge({ feedback }: { feedback: string | null }) {
  if (feedback === "more") {
    return <span className="text-xs font-light text-zinc-400">more ↑</span>;
  }

  if (feedback === "less") {
    return <span className="text-xs font-light text-zinc-400">less ↓</span>;
  }

  return null;
}

export default function DigestTodaySection({ date, papers, vaultName }: DigestTodaySectionProps) {
  return (
    <section className="flex w-full flex-col gap-6">
      <p className="text-xs font-light uppercase tracking-[0.2em] text-zinc-700">
        {date ? `Today — ${date} · assigned by recommender` : "Today"}
      </p>

      {papers.length === 0 ? (
        <p className="text-sm font-light text-zinc-600">
          No papers assigned today — daily recommender runs at 5am
        </p>
      ) : (
        <ul className="flex flex-col gap-5">
          {papers.map((paper) => (
            <li key={paper.title} className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                {paper.noteFile ? (
                  <a
                    href={obsidianLink(vaultName, paper.noteFile)}
                    className="block text-sm font-light text-zinc-100 hover:text-zinc-300"
                  >
                    {paper.title}
                  </a>
                ) : (
                  <p className="text-sm font-light text-zinc-100">{paper.title}</p>
                )}
                <p className="mt-1 text-xs font-light text-zinc-600">
                  {paper.authors} · {paper.added}
                  {paper.topics.length > 0 ? ` · ${paper.topics.join(", ")}` : ""}
                </p>
                {paper.tags.length > 0 ? (
                  <p className="mt-1 text-xs font-light text-zinc-700">{paper.tags.join(", ")}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {paper.status ? (
                  <span className="text-xs font-light text-zinc-500">{paper.status}</span>
                ) : null}
                <FeedbackBadge feedback={paper.feedback} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Verify type-check passes**

Run: `npx tsc --noEmit`
Expected: no errors related to `DigestTodaySection.tsx`.

- [ ] **Step 3: Commit**

```bash
git add app/components/DigestTodaySection.tsx
git commit -m "feat: add DigestTodaySection component"
```

---

## Task 9: `DigestRecentSection` component

**Files:**
- Create: `app/components/DigestRecentSection.tsx`

- [ ] **Step 1: Create the component**

Create `app/components/DigestRecentSection.tsx`:

```typescript
import type { RecentNote } from "@/lib/digest";

type DigestRecentSectionProps = {
  notes: RecentNote[];
  vaultName: string;
};

const VAULT_NOTES_PATH = "Articles and Papers/Reading Digest/Notes";

function obsidianLink(vaultName: string, fileName: string): string {
  const filePath = `${VAULT_NOTES_PATH}/${fileName}.md`;
  return `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(filePath)}`;
}

function relativeTime(mtimeMs: number): string {
  const diffMs = Date.now() - mtimeMs;
  const diffMinutes = Math.floor(diffMs / (60 * 1000));

  if (diffMinutes < 60) {
    return diffMinutes <= 1 ? "just now" : `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default function DigestRecentSection({ notes, vaultName }: DigestRecentSectionProps) {
  return (
    <section className="flex w-full flex-col gap-6">
      <p className="text-xs font-light uppercase tracking-[0.2em] text-zinc-700">Recently added</p>

      {notes.length === 0 ? (
        <p className="text-sm font-light text-zinc-600">No notes yet — add a paper above</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {notes.map((note) => (
            <li key={note.fileName} className="flex items-baseline justify-between gap-4">
              <a
                href={obsidianLink(vaultName, note.fileName)}
                className="min-w-0 truncate text-sm font-light text-zinc-200 hover:text-zinc-300"
              >
                {note.title}
              </a>
              <span className="shrink-0 text-xs font-light text-zinc-600">
                {note.sourceKind ? `${note.sourceKind} · ` : ""}
                {relativeTime(note.mtimeMs)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Verify type-check passes**

Run: `npx tsc --noEmit`
Expected: no errors related to `DigestRecentSection.tsx`.

- [ ] **Step 3: Commit**

```bash
git add app/components/DigestRecentSection.tsx
git commit -m "feat: add DigestRecentSection component"
```

---

## Task 10: `DigestJobBlock` component

**Files:**
- Create: `app/components/DigestJobBlock.tsx`

This block shows while a submission is in flight. Since the n8n webhook is a single blocking call (no incremental progress events), the stage label is derived from elapsed time as a heuristic: 0–90s "resolving full text", 90s+ "generating note".

- [ ] **Step 1: Create the component**

Create `app/components/DigestJobBlock.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

type DigestJobBlockProps = {
  label: string;
  error: string | null;
  onRetry: () => void;
};

const RESOLVING_STAGE_SECONDS = 90;

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function DigestJobBlock({ label, error, onRetry }: DigestJobBlockProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (error) {
      return;
    }

    const interval = setInterval(() => {
      setElapsedSeconds((seconds) => seconds + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [error]);

  if (error) {
    return (
      <div className="flex w-full flex-col gap-2 text-sm font-light text-zinc-400">
        <p>{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="self-start text-zinc-300 underline-offset-4 hover:underline"
        >
          retry
        </button>
      </div>
    );
  }

  const stage = elapsedSeconds < RESOLVING_STAGE_SECONDS ? "resolving full text" : "generating note";

  return (
    <div className="flex w-full items-center gap-3 text-sm font-light text-zinc-400">
      <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} aria-hidden="true" />
      <span className="min-w-0 truncate">{label}</span>
      <span className="text-zinc-600">{stage}</span>
      <span className="ml-auto font-mono text-xs tabular-nums text-zinc-600">
        {formatElapsed(elapsedSeconds)}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Verify type-check passes**

Run: `npx tsc --noEmit`
Expected: no errors related to `DigestJobBlock.tsx`.

- [ ] **Step 3: Commit**

```bash
git add app/components/DigestJobBlock.tsx
git commit -m "feat: add DigestJobBlock component"
```

---

## Task 11: `DigestSubmitBar` component

**Files:**
- Create: `app/components/DigestSubmitBar.tsx`

- [ ] **Step 1: Create the component**

Create `app/components/DigestSubmitBar.tsx`:

```typescript
"use client";

import { useState } from "react";

import DigestJobBlock from "./DigestJobBlock";

type SubmitState =
  | { status: "idle" }
  | { status: "submitting"; input: string }
  | { status: "error"; input: string; message: string };

type DigestSubmitBarProps = {
  onSubmitted: () => void;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong";
}

export default function DigestSubmitBar({ onSubmitted }: DigestSubmitBarProps) {
  const [value, setValue] = useState("");
  const [state, setState] = useState<SubmitState>({ status: "idle" });

  async function submit(input: string) {
    setState({ status: "submitting", input });

    try {
      const response = await fetch("/api/digest/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(typeof body?.error === "string" ? body.error : `Request failed (${response.status})`);
      }

      setState({ status: "idle" });
      setValue("");
      onSubmitted();
    } catch (error: unknown) {
      setState({ status: "error", input, message: getErrorMessage(error) });
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = value.trim();

    if (trimmed.length === 0 || state.status === "submitting") {
      return;
    }

    void submit(trimmed);
  }

  if (state.status === "submitting") {
    return <DigestJobBlock label={state.input} error={null} onRetry={() => undefined} />;
  }

  if (state.status === "error") {
    return (
      <DigestJobBlock
        label={state.input}
        error={state.message}
        onRetry={() => setState({ status: "idle" })}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-2">
      <div className="flex items-center gap-3 border-b border-zinc-800 pb-2">
        <input
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="https://arxiv.org/abs/… or paper title"
          className="w-full bg-transparent text-sm font-light text-zinc-100 placeholder:text-zinc-700 focus:outline-none"
        />
        <button
          type="submit"
          className="shrink-0 text-sm font-light text-zinc-400 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-600"
        >
          add →
        </button>
      </div>
      <p className="text-xs font-light text-zinc-700">arxiv · pmc · springer · wiley · acs · ieee · doi</p>
    </form>
  );
}
```

- [ ] **Step 2: Verify type-check passes**

Run: `npx tsc --noEmit`
Expected: no errors related to `DigestSubmitBar.tsx`.

- [ ] **Step 3: Commit**

```bash
git add app/components/DigestSubmitBar.tsx
git commit -m "feat: add DigestSubmitBar component"
```

---

## Task 12: `ReadingDigest` component — composes everything, polling

**Files:**
- Create: `app/components/ReadingDigest.tsx`
- Modify: `app/components/DashboardShell.tsx:208-216`

- [ ] **Step 1: Create the component**

Create `app/components/ReadingDigest.tsx`:

```typescript
"use client";

import { useCallback, useEffect, useState } from "react";

import type { RecentNote, TodayDigest } from "@/lib/digest";
import DigestSubmitBar from "./DigestSubmitBar";
import DigestTodaySection from "./DigestTodaySection";
import DigestRecentSection from "./DigestRecentSection";

const POLL_INTERVAL_MS = 60_000;
const VAULT_NAME = "obsidian-vault";

const EMPTY_TODAY: TodayDigest = { date: null, papers: [] };

export default function ReadingDigest() {
  const [today, setToday] = useState<TodayDigest>(EMPTY_TODAY);
  const [recent, setRecent] = useState<RecentNote[]>([]);

  const refresh = useCallback(async () => {
    const [todayResponse, recentResponse] = await Promise.all([
      fetch("/api/digest/today"),
      fetch("/api/digest/recent")
    ]);

    if (todayResponse.ok) {
      setToday(await todayResponse.json());
    }

    if (recentResponse.ok) {
      const body = await recentResponse.json();
      setRecent(body.notes ?? []);
    }
  }, []);

  useEffect(() => {
    void refresh();

    const interval = setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <div className="flex w-full flex-col gap-12">
      <DigestSubmitBar onSubmitted={refresh} />
      <DigestTodaySection date={today.date} papers={today.papers} vaultName={VAULT_NAME} />
      <DigestRecentSection notes={recent} vaultName={VAULT_NAME} />
    </div>
  );
}
```

- [ ] **Step 2: Update `DashboardShell.tsx`**

In `app/components/DashboardShell.tsx`, add an import near the other component imports (after `import TodoAnalytics from "./TodoAnalytics";`):

```typescript
import ReadingDigest from "./ReadingDigest";
```

Then replace the final branch of the view conditional (currently lines ~208-216):

```typescript
        ) : (
          <div className="flex w-full max-w-lg flex-col items-center gap-0 px-2 md:px-8">
            <PlaceholderView
              title={activeItem?.label ?? "Dashboard"}
              kicker={activeItem?.kicker ?? "placeholder"}
              locked={activeView === visibleView}
            />
          </div>
        )}
```

with:

```typescript
        ) : visibleView === "digest" ? (
          <div className="flex w-full max-w-2xl flex-col items-center gap-0 px-2 md:px-8">
            <ReadingDigest />
          </div>
        ) : (
          <div className="flex w-full max-w-lg flex-col items-center gap-0 px-2 md:px-8">
            <PlaceholderView
              title={activeItem?.label ?? "Dashboard"}
              kicker={activeItem?.kicker ?? "placeholder"}
              locked={activeView === visibleView}
            />
          </div>
        )}
```

The `ViewId` type already includes `"digest"` and `NAV_ITEMS` already has the digest entry — no other changes needed there. The trailing `PlaceholderView` branch becomes unreachable for `"digest"` but stays as the fallback for any future view IDs; this matches the existing pattern (`usage` and `tasks` are handled the same way before the fallback).

- [ ] **Step 3: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass (digest + existing suites).

- [ ] **Step 4: Verify type-check passes**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual browser verification**

Run: `npm run dev`

Open `http://localhost:3000`, click "Reading digest" in the nav. Verify:
- Submit bar renders with placeholder text and hint line
- Today section shows real papers from `~/obsidian-vault/Articles and Papers/Reading Digest/Reading Digest.md` (or the empty state if none)
- Recently added section shows notes from `Notes/`, sorted newest first
- Submitting a URL shows the job block with spinner + elapsed timer (a real submission will hit the live n8n webhook — only do this if you intend to actually run the pipeline; otherwise verify the error path by stopping n8n or using an invalid URL and confirming the retry UI appears)

Stop the dev server after verifying (`Ctrl+C`).

- [ ] **Step 6: Commit**

```bash
git add app/components/ReadingDigest.tsx app/components/DashboardShell.tsx
git commit -m "feat: wire ReadingDigest into dashboard digest view"
```

---

## Task 13: Code review

- [ ] **Step 1: Run code-reviewer**

Use the **code-reviewer** agent to review all changes from Tasks 1–12 (`git diff` against the base branch). Address any CRITICAL or HIGH issues before continuing. Pay particular attention to:
- Error handling around vault file reads (missing files, malformed frontmatter) — should degrade gracefully, not throw
- The `/api/digest/submit` route — confirm no SSRF risk (webhook URL is server-configured, not user-supplied) and that the request body is validated before use

- [ ] **Step 2: Run typescript-reviewer**

Use the **typescript-reviewer** agent on the same diff. Confirm types are explicit on exported functions/components and no `any` was introduced.

- [ ] **Step 3: Fix any issues found, then commit**

```bash
git add -A
git commit -m "fix: address code review feedback for reading digest view"
```

(Skip this commit if no changes were needed.)

---

## Task 14: Update vault prompts (separate confirmation step)

**This task touches files outside the `personal-dashboard` project** (`~/obsidian-vault/...`), which per project rules requires explicit confirmation before modifying. Do not start this task without first confirming with the user.

**Files:**
- Modify: `~/obsidian-vault/Articles and Papers/Reading Digest/_agents/prompts/note-generator.md`
- Modify: `~/obsidian-vault/Articles and Papers/Reading Digest/_agents/prompts/daily-recommender.md`

- [ ] **Step 1: Confirm with the user**

Ask: "Task 14 edits prompt files in the Obsidian vault (outside this project) to add `tags`/`feedback` frontmatter and wire the feedback → recommender scoring loop. OK to proceed?"

- [ ] **Step 2: Update `note-generator.md`**

Read `~/obsidian-vault/Articles and Papers/Reading Digest/_agents/prompts/note-generator.md`. Find the section describing the frontmatter fields written to each new note (currently: `title`, `source`, `source_kind`, `origin`, `status`, `summary_status`, `coverage`, `priority`, `intake_at`). Add two new fields to that list and to the example frontmatter block:

```yaml
tags: []           # user adds keywords in Obsidian after reading
feedback: ""       # user sets "more" or "less" in Obsidian; feeds recommender scoring
```

- [ ] **Step 3: Update `daily-recommender.md`**

Read `~/obsidian-vault/Articles and Papers/Reading Digest/_agents/prompts/daily-recommender.md`. Find the scoring algorithm section (topic relevance, recency bonus, rating bonus, priority bonus, already-seen penalty). Replace the `manual_rating`-based "rating bonus" step with:

```
- Feedback bonus: scan all notes in `Notes/` for `feedback: "more"`. For each, extract that note's `Topics` (from its corresponding Reading Digest entry, or its frontmatter topics if present) and add +0.4 to any candidate sharing a topic.
- Feedback penalty: scan for `feedback: "less"` the same way and subtract 0.4 per shared topic.
```

Remove any remaining references to `manual_rating` / star ratings in this file.

- [ ] **Step 4: Verify by reading both files back**

Read both files in full and confirm:
- `note-generator.md` example frontmatter includes `tags: []` and `feedback: ""`
- `daily-recommender.md` no longer references `manual_rating` and includes the feedback bonus/penalty logic

- [ ] **Step 5: Commit**

These files are in the Obsidian vault, which is a separate git repo (or not under git at all) — check first:

```bash
cd "/home/bcjamal/obsidian-vault" && git status --porcelain "Articles and Papers/Reading Digest/_agents/prompts/" 2>/dev/null
```

If it's a git repo, commit there with a message like `docs: add tags/feedback fields and feedback-based scoring to reading digest prompts`. If not under git, no commit step is needed — the file edits are the change.

---

## Self-Review Notes

- **Spec coverage:** Submit bar (Task 11), Active Job block (Task 10), Today section (Task 8), Recently Added (Task 9), API routes (Tasks 5–7), component wiring (Task 12), note frontmatter changes + feedback loop (Task 14), Phase 2 PDF/override/search items intentionally not built (matches spec's "Out of Scope (Phase 1)" / "Phase 2" sections — no task needed). Vault cleanup plan from the spec is vault housekeeping, independent of this build — not included as a task here; do as a separate follow-up if desired.
- **Type consistency:** `DigestPaper` (lib/digest.ts) is used by `DigestTodaySection`; `RecentNote` is used by `DigestRecentSection` and `ReadingDigest`; `TodayDigest` is used by `ReadingDigest`. Field names (`noteFile`, `sourceKind`, `mtimeMs`, `intakeAt`) are consistent across all tasks.
- **Placeholder scan:** all code blocks contain complete implementations; no TBD/TODO markers.

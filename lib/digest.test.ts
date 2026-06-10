import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { getRecentNotes, getTodayDigest, parseTodaySection } from "./digest";

const FIXTURE_VAULT_DIR = join(__dirname, "__fixtures__", "reading-digest");

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

  it("does not read frontmatter from outside the Notes directory for a malicious noteFile", async () => {
    const tempVaultDir = await mkdtemp(join(tmpdir(), "reading-digest-"));

    try {
      await mkdir(join(tempVaultDir, "Notes"), { recursive: true });
      await writeFile(
        join(tempVaultDir, "Reading Digest.md"),
        `# Reading Digest

## Today — 2026-06-08

### Malicious entry
**Authors:** Unknown
**Added:** 2026-05-02
**Topics:** Security
[[../../../etc/passwd]]
`,
        "utf-8"
      );

      const digest = await getTodayDigest(tempVaultDir);

      expect(digest.papers).toHaveLength(1);
      const [paper] = digest.papers;

      expect(paper.status).toBeNull();
      expect(paper.tags).toEqual([]);
      expect(paper.feedback).toBeNull();
    } finally {
      await rm(tempVaultDir, { recursive: true, force: true });
    }
  });
});

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

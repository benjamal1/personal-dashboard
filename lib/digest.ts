import { readFile, readdir, stat } from "node:fs/promises";
import { join, resolve, sep } from "node:path";

import matter from "gray-matter";

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

export type DigestPaper = TodayEntry & {
  status: string | null;
  tags: string[];
  feedback: string | null;
};

export type TodayDigest = {
  date: string | null;
  papers: DigestPaper[];
};

function resolveNotePath(vaultDir: string, noteFile: string): string | null {
  const notesDir = resolve(vaultDir, "Notes");
  const candidate = resolve(notesDir, `${noteFile}.md`);

  if (candidate !== notesDir && !candidate.startsWith(notesDir + sep)) {
    return null;
  }

  return candidate;
}

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
      const notePath = entry.noteFile ? resolveNotePath(vaultDir, entry.noteFile) : null;
      const frontmatter = notePath ? await readNoteFrontmatter(notePath) : null;

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

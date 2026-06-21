import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";

import matter from "gray-matter";

import { isReadStatus, type RecentNote } from "./digest-shared";
export type { RecentNote };
export { isReadStatus };

export type TodayEntry = {
  title: string;
  authors: string;
  added: string;
  topics: string[];
  noteFile: string | null;
  sourceUrl: string | null;
};

export type TodaySection = {
  date: string | null;
  entries: TodayEntry[];
};

const TODAY_HEADER_RE = /^## Today — (\d{4}-\d{2}-\d{2})\s*$/m;
const ENTRY_HEADER_RE = /^### (.+)$/;
const FIELD_RE = /^\*\*(\w+):\*\* (.+?)\s*$/;
const WIKILINK_RE = /^\[\[(.+)\]\]$/;
// Recommender writes `[title](url)` for papers that have no note yet.
const MD_LINK_RE = /^\[.+\]\((https?:\/\/[^)]+)\)$/;

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
      continue;
    }

    const mdLinkMatch = line.match(MD_LINK_RE);
    if (mdLinkMatch) {
      current.sourceUrl = mdLinkMatch[1];
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
    noteFile: entry.noteFile ?? null,
    sourceUrl: entry.sourceUrl ?? null
  };
}

export type DigestPaper = TodayEntry & {
  itemId: string | null;
  status: string | null;
  tags: string[];
  feedback: string | null;
};

type QueueItem = {
  item_id?: unknown;
  title?: unknown;
  authors?: unknown;
  added?: unknown;
  topics?: unknown;
  source?: unknown;
  note_relpath?: unknown;
};

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

// The recommender pre-computes a ranked queue (`_reading_queue.json`); the
// dashboard advances through it client-side so "next" is instant. Falls back to
// the markdown "## Today" parse when the queue file doesn't exist yet.
async function readQueuePapers(vaultDir: string): Promise<{ date: string | null; papers: DigestPaper[] } | null> {
  const queuePath = join(vaultDir, "_reading_queue.json");

  let raw: string;
  try {
    raw = await readFile(queuePath, "utf-8");
  } catch {
    return null;
  }

  let parsed: { date?: unknown; items?: unknown };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  const items = Array.isArray(parsed.items) ? (parsed.items as QueueItem[]) : [];
  const papers: DigestPaper[] = items
    .filter((item) => str(item.title).length > 0)
    .map((item) => ({
      itemId: str(item.item_id) || null,
      title: str(item.title),
      authors: str(item.authors),
      added: str(item.added),
      topics: Array.isArray(item.topics) ? item.topics.filter((t): t is string => typeof t === "string") : [],
      noteFile: str(item.note_relpath) || null,
      sourceUrl: str(item.source) || null,
      status: null,
      tags: [],
      feedback: null
    }));

  return { date: typeof parsed.date === "string" ? parsed.date : null, papers };
}

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
  const queue = await readQueuePapers(vaultDir);
  if (queue) {
    return queue;
  }

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
        itemId: null,
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
  origin: string | null;
  manualTags: string[];
};

// Human-readable provenance for the Library, derived from origin + lab tags.
// (source_kind like "vault-note" describes the file format, not where it came
// from — this answers "who/what put this here".)
export function deriveSource(
  origin: string | null,
  manualTags: string[],
  sourceKind: string | null
): string | null {
  const tags = manualTags.map((tag) => tag.toLowerCase());
  if (tags.some((tag) => tag === "surgical-informatics-lab" || tag === "silab")) return "SILab";
  if (tags.some((tag) => tag.includes("coulombe"))) return "Coulombe Lab";

  switch (origin) {
    case "slack-papers-and-more":
      return "SILab";
    case "paper-finder":
      return "Bot";
    case "n8n-intake":
      return "Uploaded";
    case "manual entry":
      return "Manual";
    case "outside suggestion":
      return "Suggested";
    default:
      return sourceKind;
  }
}

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
    intakeAt: typeof data.intake_at === "string" ? data.intake_at : null,
    origin: typeof data.origin === "string" ? data.origin : null,
    manualTags: Array.isArray(data.manual_tags)
      ? data.manual_tags.filter((tag): tag is string => typeof tag === "string")
      : []
  };
}



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
        source: deriveSource(
          frontmatter?.origin ?? null,
          frontmatter?.manualTags ?? [],
          frontmatter?.sourceKind ?? null
        ),
        status: frontmatter?.status ?? null,
        intakeAt: frontmatter?.intakeAt ?? null,
        mtimeMs: stats.mtimeMs
      };
    })
  );

  // Library order: unread on top, read at the bottom; newest first within each group.
  return notes
    .sort((a, b) => {
      const readDelta = Number(isReadStatus(a.status)) - Number(isReadStatus(b.status));
      if (readDelta !== 0) return readDelta;
      return b.mtimeMs - a.mtimeMs;
    })
    .slice(0, limit);
}

export type Priority = "high" | "normal" | "low";

// 👍/👎 on a recommendation maps to the registry item's priority, which the
// recommender already scores (+0.3 / -0.2). No prompt-logic change needed.
export async function setItemPriority(
  vaultDir: string,
  itemId: string,
  priority: Priority
): Promise<boolean> {
  const registryPath = join(vaultDir, "_reading_sources.json");

  let registry: { items?: unknown };
  try {
    registry = JSON.parse(await readFile(registryPath, "utf-8"));
  } catch {
    return false;
  }

  const items = Array.isArray(registry.items) ? (registry.items as Array<Record<string, unknown>>) : null;
  if (!items) {
    return false;
  }

  const item = items.find((entry) => entry.item_id === itemId);
  if (!item) {
    return false;
  }

  item.priority = priority;
  item.updated_at = new Date().toISOString();

  await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`, "utf-8");
  return true;
}

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

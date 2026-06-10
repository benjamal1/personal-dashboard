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

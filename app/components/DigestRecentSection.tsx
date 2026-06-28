import { ChevronUp, ChevronDown } from "lucide-react";

import { isReadStatus, type Priority, type RecentNote } from "@/lib/digest-shared";

type DigestRecentSectionProps = {
  notes: RecentNote[];
  vaultName: string;
  onSetPriority: (fileName: string, priority: Priority) => void;
};

const VAULT_NOTES_PATH = "Articles and Papers/Reading Digest/Notes";

function sanitizeNoteSegment(value: string): string {
  return value
    .split("/")
    .filter((segment) => segment !== "" && segment !== "..")
    .join("/");
}

function obsidianLink(vaultName: string, fileName: string): string {
  const filePath = `${VAULT_NOTES_PATH}/${sanitizeNoteSegment(fileName)}`;
  return `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(filePath)}`;
}

// High = dull on-theme red, low = dimmed, normal = current zinc.
function titleClass(priority: Priority | null): string {
  if (priority === "high") return "text-red-300/90 hover:text-red-200";
  if (priority === "low") return "text-zinc-600 hover:text-zinc-400";
  return "text-zinc-200 hover:text-zinc-300";
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

export default function DigestRecentSection({ notes, vaultName, onSetPriority }: DigestRecentSectionProps) {
  const unread = notes.filter((note) => !isReadStatus(note.status));
  const read = notes.filter((note) => isReadStatus(note.status));

  function renderRow(note: RecentNote) {
    // Clicking the active level again clears back to normal.
    const set = (level: Priority) => onSetPriority(note.fileName, note.priority === level ? "normal" : level);

    return (
      <li key={note.fileName} className="flex items-baseline justify-between gap-4">
        <a
          href={obsidianLink(vaultName, note.fileName)}
          className={`min-w-0 truncate text-sm font-light ${titleClass(note.priority)}`}
        >
          {note.title}
        </a>
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex items-center">
            <button
              type="button"
              aria-label="Raise priority"
              aria-pressed={note.priority === "high"}
              onClick={() => set("high")}
              className={`focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-600 ${
                note.priority === "high" ? "text-red-300" : "text-zinc-700 hover:text-zinc-400"
              }`}
            >
              <ChevronUp className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Lower priority"
              aria-pressed={note.priority === "low"}
              onClick={() => set("low")}
              className={`focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-600 ${
                note.priority === "low" ? "text-zinc-400" : "text-zinc-700 hover:text-zinc-400"
              }`}
            >
              <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
          <span className="text-xs font-light text-zinc-600">
            {note.source ? `${note.source} · ` : ""}
            {relativeTime(note.mtimeMs)}
          </span>
        </div>
      </li>
    );
  }

  return (
    <section className="flex w-full flex-col gap-6">
      <p className="text-xs font-light uppercase tracking-[0.2em] text-zinc-700">Library</p>

      {notes.length === 0 ? (
        <p className="text-sm font-light text-zinc-600">No notes yet — add a paper above</p>
      ) : (
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <p className="text-[0.65rem] font-light uppercase tracking-[0.25em] text-zinc-600">
              To read · {unread.length}
            </p>
            {unread.length === 0 ? (
              <p className="text-sm font-light text-zinc-700">Nothing unread</p>
            ) : (
              <ul className="flex flex-col gap-3">{unread.map(renderRow)}</ul>
            )}
          </div>

          {read.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-[0.65rem] font-light uppercase tracking-[0.25em] text-zinc-700">
                Read · {read.length}
              </p>
              <ul className="flex flex-col gap-3 opacity-60">{read.map(renderRow)}</ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

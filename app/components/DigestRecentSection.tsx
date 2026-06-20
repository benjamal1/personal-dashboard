import { isReadStatus, type RecentNote } from "@/lib/digest-shared";

type DigestRecentSectionProps = {
  notes: RecentNote[];
  vaultName: string;
};

const VAULT_NOTES_PATH = "Articles and Papers/Reading Digest/Notes";

function sanitizeNoteSegment(value: string): string {
  return value
    .split("/")
    .filter((segment) => segment !== "" && segment !== "..")
    .join("/");
}

function obsidianLink(vaultName: string, fileName: string): string {
  const filePath = `${VAULT_NOTES_PATH}/${sanitizeNoteSegment(fileName)}.md`;
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
  const unread = notes.filter((note) => !isReadStatus(note.status));
  const read = notes.filter((note) => isReadStatus(note.status));

  function renderRow(note: RecentNote) {
    return (
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

export type RecentNote = {
  fileName: string;
  title: string;
  sourceKind: string | null;
  status: string | null;
  intakeAt: string | null;
  mtimeMs: number;
};

// A paper the user submitted that has no note yet — the resolver/note pipeline
// runs async (~15 min). Tracked client-side so the submission stays visible
// until a matching note lands (or it's deemed failed). UI-only, not persisted
// in the vault.
export type PendingItem = {
  id: string;
  input: string;
  submittedAt: number;
  failed: boolean;
};

const READ_STATUSES = new Set(["read_summary", "read", "archived"]);

export function isReadStatus(status: string | null): boolean {
  if (!status) return false;
  return READ_STATUSES.has(status.trim().toLowerCase().replace(/ /g, "_"));
}

// A submitted paper resolves async (~12 min) then a note is written (~8 min).
// Past this, an unmatched pending item is treated as "may have failed".
export const RESOLVE_TIMEOUT_MS = 25 * 60 * 1000;

// Drop pending items once a note newer than their submit time exists (each
// submit yields exactly one note); flag the rest as failed past the timeout.
// Greedy 1:1 match so concurrent submits don't both claim the same note.
export function reconcilePending(
  pending: PendingItem[],
  notes: RecentNote[],
  now: number = Date.now()
): PendingItem[] {
  if (pending.length === 0) {
    return pending;
  }

  const fresh = [...notes].sort((a, b) => a.mtimeMs - b.mtimeMs);
  const claimed = new Set<string>();
  const next: PendingItem[] = [];

  for (const item of [...pending].sort((a, b) => a.submittedAt - b.submittedAt)) {
    const match = fresh.find((note) => !claimed.has(note.fileName) && note.mtimeMs > item.submittedAt);
    if (match) {
      claimed.add(match.fileName);
      continue;
    }
    next.push({ ...item, failed: now - item.submittedAt > RESOLVE_TIMEOUT_MS });
  }

  return next;
}

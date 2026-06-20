export type RecentNote = {
  fileName: string;
  title: string;
  sourceKind: string | null;
  status: string | null;
  intakeAt: string | null;
  mtimeMs: number;
};

const READ_STATUSES = new Set(["read_summary", "read", "archived"]);

export function isReadStatus(status: string | null): boolean {
  if (!status) return false;
  return READ_STATUSES.has(status.trim().toLowerCase().replace(/ /g, "_"));
}

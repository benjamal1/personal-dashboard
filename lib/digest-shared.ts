export type Priority = "high" | "normal" | "low";

export type RecentNote = {
  fileName: string;
  title: string;
  sourceKind: string | null;
  source: string | null;
  status: string | null;
  priority: Priority | null;
  intakeAt: string | null;
  mtimeMs: number;
};

const READ_STATUSES = new Set(["read_summary", "read", "archived"]);

export function isReadStatus(status: string | null): boolean {
  if (!status) return false;
  return READ_STATUSES.has(status.trim().toLowerCase().replace(/ /g, "_"));
}

// Intake queue: a submitted paper tracked through the pipeline. Status is
// reported by n8n per stage; items persist and stay visible until cleared.
export type IntakeStage = "queued" | "resolver" | "note";
export type IntakeState = "pending" | "running" | "done" | "failed";

export type IntakeItem = {
  id: string;
  input: string;
  source: string | null;
  createdAt: number;
  updatedAt: number;
  stage: IntakeStage;
  state: IntakeState;
  noteFile: string | null;
  summary: string | null;
  error: string | null;
};

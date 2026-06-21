import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

// Server-side intake queue: papers the user submitted, tracked through the
// pipeline (queued -> resolver -> note) with live status reported by n8n. Items
// persist and stay visible — even after completion — until the user clears them.
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

const INTAKE_FILE = process.env.DIGEST_INTAKE_FILE ?? join(process.cwd(), "data", "intake.json");

// Serialize read-modify-write so concurrent n8n status POSTs don't clobber.
let writeChain: Promise<unknown> = Promise.resolve();

async function readItems(): Promise<IntakeItem[]> {
  try {
    const parsed = JSON.parse(await readFile(INTAKE_FILE, "utf-8")) as { items?: IntakeItem[] };
    return Array.isArray(parsed.items) ? parsed.items : [];
  } catch {
    return [];
  }
}

async function writeItems(items: IntakeItem[]): Promise<void> {
  await mkdir(dirname(INTAKE_FILE), { recursive: true });
  await writeFile(INTAKE_FILE, `${JSON.stringify({ items }, null, 2)}\n`, "utf-8");
}

function mutate<T>(fn: (items: IntakeItem[]) => { items: IntakeItem[]; result: T }): Promise<T> {
  const next = writeChain.then(async () => {
    const items = await readItems();
    const { items: updated, result } = fn(items);
    await writeItems(updated);
    return result;
  });
  // keep the chain alive but don't let a rejection break future writes
  writeChain = next.catch(() => undefined);
  return next;
}

export function listIntake(): Promise<IntakeItem[]> {
  return readItems();
}

export function addIntakeItems(inputs: string[]): Promise<IntakeItem[]> {
  return mutate((items) => {
    const now = Date.now();
    const created = inputs.map((input) => ({
      id: randomUUID(),
      input,
      source: null,
      createdAt: now,
      updatedAt: now,
      stage: "queued" as IntakeStage,
      state: "pending" as IntakeState,
      noteFile: null,
      summary: null,
      error: null
    }));
    return { items: [...created, ...items], result: created };
  });
}

export type StatusUpdate = {
  id: string;
  stage: IntakeStage;
  state: IntakeState;
  noteFile?: string | null;
  summary?: string | null;
  error?: string | null;
};

export function applyStatus(update: StatusUpdate): Promise<boolean> {
  return mutate((items) => {
    const idx = items.findIndex((item) => item.id === update.id);
    if (idx === -1) {
      return { items, result: false };
    }
    const prev = items[idx];
    const next: IntakeItem = {
      ...prev,
      stage: update.stage,
      state: update.state,
      noteFile: update.noteFile ?? prev.noteFile,
      summary: update.summary ?? prev.summary,
      error: update.state === "failed" ? update.error ?? prev.error : null,
      updatedAt: Date.now()
    };
    const copy = [...items];
    copy[idx] = next;
    return { items: copy, result: true };
  });
}

export function setIntakeSource(id: string, source: string): Promise<boolean> {
  return mutate((items) => {
    const idx = items.findIndex((item) => item.id === id);
    if (idx === -1) {
      return { items, result: false };
    }
    const copy = [...items];
    copy[idx] = { ...copy[idx], source, updatedAt: Date.now() };
    return { items: copy, result: true };
  });
}

// clear one (id) or all completed (id omitted).
export function clearIntake(id?: string): Promise<number> {
  return mutate((items) => {
    const keep = id ? items.filter((item) => item.id !== id) : items.filter((item) => item.state !== "done");
    return { items: keep, result: items.length - keep.length };
  });
}

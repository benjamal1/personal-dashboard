import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Habit = {
  id: string;
  name: string;
  createdAt: string;
  archivedAt?: string;
  goal?: number;
};

type HabitStore = {
  habits: Habit[];
  completions: Record<string, Record<string, number>>; // date → habitId → count
};

const FILE_PATH = join(process.cwd(), "data", "habits.json");

async function loadStore(): Promise<HabitStore> {
  try {
    const contents = await readFile(FILE_PATH, "utf8");
    return JSON.parse(contents) as HabitStore;
  } catch {
    return { habits: [], completions: {} };
  }
}

async function saveStore(store: HabitStore): Promise<void> {
  await mkdir(dirname(FILE_PATH), { recursive: true });
  await writeFile(FILE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { orderedIds?: unknown };
    if (!Array.isArray(body.orderedIds) || !body.orderedIds.every((id) => typeof id === "string")) {
      return NextResponse.json({ error: "orderedIds must be string[]" }, { status: 400 });
    }
    const orderedIds = body.orderedIds as string[];

    const store = await loadStore();
    // Reorder: build a map for fast lookup, then sort
    const habitMap = new Map(store.habits.map((h) => [h.id, h]));
    const reordered = orderedIds.map((id) => habitMap.get(id)).filter(Boolean) as Habit[];
    // Append any habits not in orderedIds (safety)
    const reorderedIds = new Set(orderedIds);
    const remaining = store.habits.filter((h) => !reorderedIds.has(h.id));
    store.habits = [...reordered, ...remaining];

    await saveStore(store);
    return NextResponse.json({ habits: store.habits });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to reorder" },
      { status: 500 }
    );
  }
}

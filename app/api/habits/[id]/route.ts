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

type RouteContext = {
  params: {
    id: string;
  };
};

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const store = await loadStore();
    const exists = store.habits.some((h) => h.id === params.id);

    if (!exists) {
      return NextResponse.json({ error: "Habit not found" }, { status: 404 });
    }

    // Remove habit
    store.habits = store.habits.filter((h) => h.id !== params.id);

    // Remove all completions for this habit
    for (const [date, counts] of Object.entries(store.completions)) {
      delete counts[params.id];
      if (Object.keys(counts).length === 0) delete store.completions[date];
    }

    await saveStore(store);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete habit" },
      { status: 500 }
    );
  }
}

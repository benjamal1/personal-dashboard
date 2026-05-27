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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { habitId?: unknown; date?: unknown };

    if (typeof body.habitId !== "string" || !body.habitId.trim()) {
      return NextResponse.json({ error: "habitId is required" }, { status: 400 });
    }

    if (typeof body.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
    }

    const { habitId, date } = body as { habitId: string; date: string };

    const store = await loadStore();

    const goal = store.habits.find((h) => h.id === habitId)?.goal ?? 1;
    const dayMap = store.completions[date] ?? {};
    const currentCount = dayMap[habitId] ?? 0;
    const newCount = (currentCount + 1) % (goal + 1);

    if (newCount === 0) {
      delete dayMap[habitId];
    } else {
      dayMap[habitId] = newCount;
    }

    if (Object.keys(dayMap).length === 0) {
      delete store.completions[date];
    } else {
      store.completions[date] = dayMap;
    }

    await saveStore(store);

    return NextResponse.json({ date, completions: store.completions[date] ?? {} });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to toggle completion" },
      { status: 500 }
    );
  }
}

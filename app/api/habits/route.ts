import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Habit = {
  id: string;
  name: string;
  createdAt: string;
  archivedAt?: string;
  goal?: number; // if undefined or 1: boolean habit. if > 1: tiered habit
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

export async function GET() {
  try {
    const store = await loadStore();

    return NextResponse.json({
      habits: store.habits,
      completions: store.completions
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load habits" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { name?: unknown; goal?: unknown };

    if (typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json({ error: "Habit name is required" }, { status: 400 });
    }

    const goal =
      typeof body.goal === "number" && Number.isInteger(body.goal) && body.goal >= 1
        ? body.goal
        : undefined;

    const store = await loadStore();
    const habit: Habit = {
      id: randomUUID(),
      name: body.name.trim(),
      createdAt: new Date().toISOString(),
      ...(goal !== undefined && goal > 1 ? { goal } : {})
    };

    store.habits.push(habit);
    await saveStore(store);

    return NextResponse.json({ habits: store.habits }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add habit" },
      { status: 500 }
    );
  }
}

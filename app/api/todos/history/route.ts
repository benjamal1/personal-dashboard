import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TodoItem = {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
  status?: "pushed" | "abandoned";
};

type TodoLogEntry = {
  week: string;
  todos: TodoItem[];
};

type TodoStore = {
  currentWeek: string;
  todos: TodoItem[];
  log: TodoLogEntry[];
};

type WeekStats = {
  total: number;
  done: number;
  pushed: number;
  abandoned: number;
  completionRate: number;
};

type EnrichedWeek = {
  week: string;
  weekLabel: string;
  todos: TodoItem[];
  stats: WeekStats;
};

const FILE_PATH = join(process.cwd(), "data", "todos.json");

function getWeekLabel(weekId: string): string {
  // weekId is like "2026-W21"
  const match = weekId.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return weekId;

  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);

  // ISO week: week 1 is the week containing January 4th
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay(); // 0=Sun, 1=Mon...
  // Monday of week 1
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - ((dayOfWeek + 6) % 7));

  const weekStart = new Date(week1Monday);
  weekStart.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);

  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);

  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  });

  return `${formatter.format(weekStart)} – ${formatter.format(weekEnd)}`;
}

function computeStats(todos: TodoItem[]): WeekStats {
  const total = todos.length;
  const done = todos.filter((t) => t.done).length;
  const pushed = todos.filter((t) => !t.done && t.status === "pushed").length;
  const abandoned = todos.filter((t) => !t.done && t.status === "abandoned").length;
  const completionRate = total === 0 ? 0 : Math.round((done / total) * 100);

  return { total, done, pushed, abandoned, completionRate };
}

function needsTriage(entry: TodoLogEntry): boolean {
  // Needs triage if any non-done todo has no status field
  return entry.todos.some((t) => !t.done && !t.status);
}

export async function GET() {
  try {
    let store: TodoStore;
    try {
      const contents = await readFile(FILE_PATH, "utf8");
      store = JSON.parse(contents) as TodoStore;
    } catch {
      return NextResponse.json({ history: [], needsTriage: [] });
    }

    const currentWeek = store.currentWeek;

    const allHistory: EnrichedWeek[] = (store.log ?? []).map((entry) => ({
      week: entry.week,
      weekLabel: getWeekLabel(entry.week),
      todos: entry.todos,
      stats: computeStats(entry.todos)
    }));

    // needsTriage: past weeks (not current) where some todos have no status and are not done
    const triageNeeded: EnrichedWeek[] = allHistory
      .filter((entry) => entry.week !== currentWeek && needsTriage({ week: entry.week, todos: entry.todos }))
      .slice(-5); // show at most last 5 untriaged weeks

    return NextResponse.json({
      history: allHistory,
      needsTriage: triageNeeded
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load history" },
      { status: 500 }
    );
  }
}

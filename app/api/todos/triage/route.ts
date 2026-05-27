import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
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

const FILE_PATH = join(process.cwd(), "data", "todos.json");

async function loadStore(): Promise<TodoStore> {
  try {
    const contents = await readFile(FILE_PATH, "utf8");
    return JSON.parse(contents) as TodoStore;
  } catch {
    throw new Error("Could not read todos.json");
  }
}

async function saveStore(store: TodoStore): Promise<void> {
  await mkdir(dirname(FILE_PATH), { recursive: true });
  await writeFile(FILE_PATH, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      week?: unknown;
      updates?: unknown;
    };

    if (typeof body.week !== "string") {
      return NextResponse.json({ error: "week is required" }, { status: 400 });
    }

    if (!Array.isArray(body.updates)) {
      return NextResponse.json({ error: "updates must be an array" }, { status: 400 });
    }

    const updates = body.updates as Array<{ id: string; status: "pushed" | "abandoned" }>;

    const store = await loadStore();

    const logEntry = store.log.find((entry) => entry.week === body.week);
    if (!logEntry) {
      return NextResponse.json({ error: "Week not found in log" }, { status: 404 });
    }

    const pushedTodos: TodoItem[] = [];

    // Apply status updates to the log entry
    for (const update of updates) {
      const todo = logEntry.todos.find((t) => t.id === update.id);
      if (todo && !todo.done) {
        todo.status = update.status;
        if (update.status === "pushed") {
          pushedTodos.push(todo);
        }
      }
    }

    // Add pushed todos to current week as new todos
    for (const todo of pushedTodos) {
      store.todos.push({
        id: randomUUID(),
        text: todo.text,
        done: false,
        createdAt: new Date().toISOString()
      });
    }

    await saveStore(store);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to triage" },
      { status: 500 }
    );
  }
}

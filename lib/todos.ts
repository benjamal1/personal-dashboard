import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

export type TodoItem = {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
};

export type TodoLogEntry = {
  week: string;
  todos: TodoItem[];
};

export type TodoStore = {
  currentWeek: string;
  todos: TodoItem[];
  log: TodoLogEntry[];
};

export type TodoListPayload = {
  currentWeek: string;
  weekLabel: string;
  todos: TodoItem[];
};

const DEFAULT_FILE_PATH = join(process.cwd(), "data", "todos.json");
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function getCurrentWeekId(date: Date) {
  const weekStart = getWeekStart(date);
  const weekYear = getWeekYear(weekStart);
  const firstWeekStart = getWeekStart(new Date(weekYear, 0, 4));
  const weekNumber = Math.floor((weekStart.getTime() - firstWeekStart.getTime()) / WEEK_MS) + 1;

  return `${weekYear}-W${String(weekNumber).padStart(2, "0")}`;
}

export function getWeekLabel(date: Date) {
  const weekStart = getWeekStart(date);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);

  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  });

  return `${formatter.format(weekStart)} - ${formatter.format(weekEnd)}`;
}

export function createEmptyTodoStore(currentWeek = getCurrentWeekId(new Date())): TodoStore {
  return {
    currentWeek,
    todos: [],
    log: []
  };
}

export async function loadTodoStore(
  filePath = DEFAULT_FILE_PATH,
  now = new Date(),
  fallbackStore?: TodoStore
) {
  const currentWeek = getCurrentWeekId(now);
  const existing = fallbackStore ?? (await readStoredTodoStore(filePath, currentWeek));
  const store = rolloverTodoStore(normalizeTodoStore(existing, currentWeek), currentWeek);

  await persistTodoStore(filePath, store);

  return store;
}

export async function getTodoList(filePath = DEFAULT_FILE_PATH, now = new Date()): Promise<TodoListPayload> {
  const store = await loadTodoStore(filePath, now);

  return {
    currentWeek: store.currentWeek,
    weekLabel: getWeekLabel(now),
    todos: store.todos
  };
}

export async function addTodo(filePath = DEFAULT_FILE_PATH, text: string, now = new Date()) {
  const trimmedText = text.trim();

  if (!trimmedText) {
    throw new Error("Todo text is required");
  }

  const store = await loadTodoStore(filePath, now);
  const todo: TodoItem = {
    id: randomUUID(),
    text: trimmedText,
    done: false,
    createdAt: now.toISOString()
  };

  store.todos.push(todo);
  await persistTodoStore(filePath, store);

  return todo;
}

export async function toggleTodo(filePath = DEFAULT_FILE_PATH, id: string, now = new Date()) {
  const store = await loadTodoStore(filePath, now);
  const todo = store.todos.find((item) => item.id === id);

  if (!todo) {
    return null;
  }

  todo.done = !todo.done;
  await persistTodoStore(filePath, store);

  return todo;
}

export async function deleteTodo(filePath = DEFAULT_FILE_PATH, id: string, now = new Date()) {
  const store = await loadTodoStore(filePath, now);
  const nextTodos = store.todos.filter((item) => item.id !== id);

  if (nextTodos.length === store.todos.length) {
    return false;
  }

  store.todos = nextTodos;
  await persistTodoStore(filePath, store);

  return true;
}

function getWeekStart(date: Date) {
  const localDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayOffset = (localDate.getUTCDay() + 6) % 7;
  localDate.setUTCDate(localDate.getUTCDate() - dayOffset);

  return localDate;
}

function getWeekYear(weekStart: Date) {
  const thursday = new Date(weekStart);
  thursday.setUTCDate(weekStart.getUTCDate() + 3);

  return thursday.getUTCFullYear();
}

function rolloverTodoStore(store: TodoStore, currentWeek: string) {
  if (store.currentWeek === currentWeek) {
    return store;
  }

  return {
    currentWeek,
    todos: [],
    log: [
      ...store.log,
      {
        week: store.currentWeek,
        todos: store.todos
      }
    ]
  };
}

function normalizeTodoStore(store: TodoStore, currentWeek: string): TodoStore {
  return {
    currentWeek: typeof store.currentWeek === "string" ? store.currentWeek : currentWeek,
    todos: Array.isArray(store.todos) ? store.todos : [],
    log: Array.isArray(store.log) ? store.log : []
  };
}

async function readStoredTodoStore(filePath: string, currentWeek: string) {
  try {
    const contents = await readFile(filePath, "utf8");
    return JSON.parse(contents) as TodoStore;
  } catch {
    return createEmptyTodoStore(currentWeek);
  }
}

async function persistTodoStore(filePath: string, store: TodoStore) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

import { mkdtempSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import {
  addTodo,
  createEmptyTodoStore,
  deleteTodo,
  getCurrentWeekId,
  getWeekLabel,
  loadTodoStore,
  toggleTodo
} from "./todos";

const tempDirs: string[] = [];

describe("todo store", () => {
  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it("uses ISO weeks with Monday as the first day of the week", () => {
    expect(getCurrentWeekId(new Date("2026-05-23T12:00:00Z"))).toBe("2026-W21");
    expect(getCurrentWeekId(new Date("2027-01-01T12:00:00Z"))).toBe("2026-W53");
  });

  it("formats the week label from Monday through Sunday", () => {
    expect(getWeekLabel(new Date("2026-05-23T12:00:00Z"))).toBe("May 18 - May 24");
    expect(getWeekLabel(new Date("2026-06-01T12:00:00Z"))).toBe("Jun 1 - Jun 7");
  });

  it("archives stale todos when a new week starts", async () => {
    const filePath = createTempFilePath();
    const store = createEmptyTodoStore("2026-W20");

    store.todos.push({
      id: "todo-1",
      text: "Finish report",
      done: false,
      createdAt: "2026-05-15T10:00:00.000Z"
    });

    await loadTodoStore(filePath, new Date("2026-05-23T12:00:00Z"), store);

    const saved = JSON.parse(readFileSync(filePath, "utf8")) as ReturnType<typeof createEmptyTodoStore>;

    expect(saved.currentWeek).toBe("2026-W21");
    expect(saved.todos).toEqual([]);
    expect(saved.log).toEqual([
      {
        week: "2026-W20",
        todos: [
          {
            id: "todo-1",
            text: "Finish report",
            done: false,
            createdAt: "2026-05-15T10:00:00.000Z"
          }
        ]
      }
    ]);
  });

  it("adds, toggles, and deletes todos in the JSON file", async () => {
    const filePath = createTempFilePath();
    const now = new Date("2026-05-23T12:00:00Z");

    const added = await addTodo(filePath, "Buy groceries", now);
    expect(added.text).toBe("Buy groceries");
    expect(added.done).toBe(false);

    const toggled = await toggleTodo(filePath, added.id, now);
    expect(toggled?.done).toBe(true);

    const removed = await deleteTodo(filePath, added.id, now);
    expect(removed).toBe(true);

    const saved = JSON.parse(readFileSync(filePath, "utf8")) as ReturnType<typeof createEmptyTodoStore>;
    expect(saved.currentWeek).toBe("2026-W21");
    expect(saved.todos).toEqual([]);
  });
});

function createTempFilePath() {
  const dir = mkdtempSync(join(tmpdir(), "todo-store-"));
  tempDirs.push(dir);

  return join(dir, "todos.json");
}

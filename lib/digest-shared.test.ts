import { describe, expect, test } from "vitest";

import { reconcilePending, RESOLVE_TIMEOUT_MS, type PendingItem, type RecentNote } from "./digest-shared";

function note(fileName: string, mtimeMs: number): RecentNote {
  return { fileName, title: fileName, sourceKind: "arxiv", source: "Uploaded", status: "to_read", intakeAt: null, mtimeMs };
}

function pending(id: string, submittedAt: number): PendingItem {
  return { id, input: id, submittedAt, failed: false };
}

describe("reconcilePending", () => {
  const NOW = 1_000_000_000;

  test("drops a pending item once a newer note exists", () => {
    const result = reconcilePending([pending("a", NOW - 1000)], [note("paper", NOW)], NOW);
    expect(result).toEqual([]);
  });

  test("keeps a pending item when no note is newer than its submit time", () => {
    const result = reconcilePending([pending("a", NOW)], [note("old", NOW - 5000)], NOW);
    expect(result).toHaveLength(1);
    expect(result[0].failed).toBe(false);
  });

  test("flags an unmatched item as failed past the timeout", () => {
    const result = reconcilePending([pending("a", NOW - RESOLVE_TIMEOUT_MS - 1)], [], NOW);
    expect(result[0].failed).toBe(true);
  });

  test("matches greedily 1:1 — two submits do not both claim one note", () => {
    const items = [pending("first", NOW - 2000), pending("second", NOW - 1000)];
    const result = reconcilePending(items, [note("only", NOW)], NOW);
    // one note can only resolve one pending; the other stays
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("second");
  });

  test("returns the same array reference when nothing is pending", () => {
    const empty: PendingItem[] = [];
    expect(reconcilePending(empty, [note("x", NOW)], NOW)).toBe(empty);
  });
});

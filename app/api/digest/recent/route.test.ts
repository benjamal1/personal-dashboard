import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/digest", () => ({
  getRecentNotes: vi.fn(async () => [
    {
      fileName: "sample-paper",
      title: "Sample Paper",
      sourceKind: "arxiv",
      intakeAt: "2026-06-08T00:00:00Z",
      mtimeMs: 1_000_000
    }
  ])
}));

import { GET } from "./route";

describe("GET /api/digest/recent", () => {
  it("returns up to 10 recent notes as JSON", async () => {
    const response = await GET();
    const body = await response.json();

    expect(body.notes).toHaveLength(1);
    expect(body.notes[0].fileName).toBe("sample-paper");
  });
});

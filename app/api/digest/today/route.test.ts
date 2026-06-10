import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/digest", () => ({
  getTodayDigest: vi.fn(async () => ({
    date: "2026-06-08",
    papers: [
      {
        title: "Sample Paper",
        authors: "Someone",
        added: "2026-06-01",
        topics: ["Topic A"],
        noteFile: "sample-paper",
        status: "to read",
        tags: [],
        feedback: null
      }
    ]
  }))
}));

import { GET } from "./route";

describe("GET /api/digest/today", () => {
  it("returns the today digest as JSON", async () => {
    const response = await GET();
    const body = await response.json();

    expect(body.date).toBe("2026-06-08");
    expect(body.papers).toHaveLength(1);
    expect(body.papers[0].title).toBe("Sample Paper");
  });
});

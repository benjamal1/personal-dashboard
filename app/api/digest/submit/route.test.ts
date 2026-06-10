import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/digest", () => ({
  submitPaper: vi.fn(async (_url: string, input: string) => ({ status: "ok", input }))
}));

import { submitPaper } from "@/lib/digest";
import { POST } from "./route";

describe("POST /api/digest/submit", () => {
  it("forwards the input field to submitPaper and returns its result", async () => {
    const request = new Request("http://localhost/api/digest/submit", {
      method: "POST",
      body: JSON.stringify({ input: "https://arxiv.org/abs/1234.5678" }),
      headers: { "Content-Type": "application/json" }
    });

    const response = await POST(request);
    const body = await response.json();

    expect(submitPaper).toHaveBeenCalledWith(expect.any(String), "https://arxiv.org/abs/1234.5678");
    expect(body).toEqual({ status: "ok", input: "https://arxiv.org/abs/1234.5678" });
  });

  it("returns 400 when input is missing or empty", async () => {
    const request = new Request("http://localhost/api/digest/submit", {
      method: "POST",
      body: JSON.stringify({ input: "  " }),
      headers: { "Content-Type": "application/json" }
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("returns 400 when JSON body is malformed", async () => {
    const request = new Request("http://localhost/api/digest/submit", {
      method: "POST",
      body: "not valid json",
      headers: { "Content-Type": "application/json" }
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Invalid JSON body" });
  });

  it("returns 400 when input exceeds max length", async () => {
    const longInput = "a".repeat(10001);

    const request = new Request("http://localhost/api/digest/submit", {
      method: "POST",
      body: JSON.stringify({ input: longInput }),
      headers: { "Content-Type": "application/json" }
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Input too long" });
  });

  it("returns 502 when submitPaper throws", async () => {
    vi.mocked(submitPaper).mockRejectedValueOnce(new Error("Reading digest webhook returned 500"));

    const request = new Request("http://localhost/api/digest/submit", {
      method: "POST",
      body: JSON.stringify({ input: "https://arxiv.org/abs/1234.5678" }),
      headers: { "Content-Type": "application/json" }
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toEqual({ error: "Failed to reach reading digest service" });
  });
});

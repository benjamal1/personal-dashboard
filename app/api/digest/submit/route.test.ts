import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { addIntakeItems, applyStatus } = vi.hoisted(() => ({
  addIntakeItems: vi.fn(async (inputs: string[]) =>
    inputs.map((input, i) => ({
      id: `id-${i}`,
      input,
      source: null,
      createdAt: 0,
      updatedAt: 0,
      stage: "queued",
      state: "pending",
      noteFile: null,
      summary: null,
      error: null
    }))
  ),
  applyStatus: vi.fn(async () => true)
}));

vi.mock("@/lib/digest-intake", () => ({ addIntakeItems, applyStatus }));

import { POST } from "./route";

function post(body: unknown): Request {
  return new Request("http://localhost/api/digest/submit", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" }
  });
}

describe("POST /api/digest/submit", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("creates an intake item and fires the webhook with its id", async () => {
    const response = await POST(post({ input: "https://arxiv.org/abs/1234.5678" }));
    const body = await response.json();

    expect(addIntakeItems).toHaveBeenCalledWith(["https://arxiv.org/abs/1234.5678"]);
    expect(body.status).toBe("queued");
    expect(body.items).toHaveLength(1);

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const sent = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(sent).toEqual({ intakeId: "id-0", input: "https://arxiv.org/abs/1234.5678" });
  });

  it("accepts multiple inputs and fires one webhook each", async () => {
    const response = await POST(post({ inputs: ["a-url", "b-url"] }));
    const body = await response.json();

    expect(addIntakeItems).toHaveBeenCalledWith(["a-url", "b-url"]);
    expect(body.items).toHaveLength(2);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });

  it("returns 400 when no usable input is provided", async () => {
    const response = await POST(post({ input: "   " }));
    expect(response.status).toBe(400);
  });

  it("returns 400 when the JSON body is malformed", async () => {
    const request = new Request("http://localhost/api/digest/submit", {
      method: "POST",
      body: "not valid json",
      headers: { "Content-Type": "application/json" }
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("marks the item failed when the webhook errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    await POST(post({ input: "https://arxiv.org/abs/1234.5678" }));
    expect(applyStatus).toHaveBeenCalledWith(expect.objectContaining({ id: "id-0", state: "failed" }));
  });
});

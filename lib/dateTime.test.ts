import { describe, expect, it } from "vitest";

import { formatDate, formatTime } from "./dateTime";

describe("dateTime formatting", () => {
  it("renders the full weekday, month, day, and year in US English", () => {
    const sample = new Date("2026-05-21T13:04:05");

    expect(formatDate(sample)).toBe("Thursday, May 21, 2026");
  });

  it("renders time as zero-padded 24-hour HH:MM:SS", () => {
    const sample = new Date("2026-05-22T03:04:05");

    expect(formatTime(sample)).toBe("03:04:05");
  });
});

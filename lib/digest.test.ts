import { describe, expect, it } from "vitest";

import { parseTodaySection } from "./digest";

const SAMPLE_DIGEST = `# Reading Digest

> [!info] Main entry points
> The dashboard is primary.

## Workflows
- Open the dashboard: [[Reading Digest Dashboard]]

## Today — 2026-06-08

### Cardiac tissue engineering: an emerging approach to the treatment of heart failure
**Authors:** Pisheh et al.
**Added:** 2026-05-02
**Topics:** Cardiac Tissue Engineering, Cardiovascular Biology
[[Pisheh - Cardiac tissue engineering: an emerging approach to the]]

### MedOS AI XR Cobot World Model for Clinical
**Authors:** Unknown
**Added:** 2026-05-02
**Topics:** Machine Learning
[[MedOS AI XR Cobot World Model for Clinical]]
`;

describe("parseTodaySection", () => {
  it("extracts the date and each paper entry", () => {
    const result = parseTodaySection(SAMPLE_DIGEST);

    expect(result.date).toBe("2026-06-08");
    expect(result.entries).toHaveLength(2);
  });

  it("extracts title, authors, added date, topics, and note file for each entry", () => {
    const result = parseTodaySection(SAMPLE_DIGEST);
    const [first] = result.entries;

    expect(first.title).toBe(
      "Cardiac tissue engineering: an emerging approach to the treatment of heart failure"
    );
    expect(first.authors).toBe("Pisheh et al.");
    expect(first.added).toBe("2026-05-02");
    expect(first.topics).toEqual(["Cardiac Tissue Engineering", "Cardiovascular Biology"]);
    expect(first.noteFile).toBe("Pisheh - Cardiac tissue engineering: an emerging approach to the");
  });

  it("returns an empty entries array and null date when there is no Today section", () => {
    const result = parseTodaySection("# Reading Digest\n\nNo today section here.\n");

    expect(result.date).toBeNull();
    expect(result.entries).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";

import { derivePaceFromWindows, normalizeCostResult, parsePaceLine } from "./usage";

describe("usage parsing", () => {
  it("parses deficit pace lines", () => {
    expect(
      parsePaceLine("Pace: 5% in deficit | Expected 93% used | Runs out in 3h 11m")
    ).toEqual({
      status: "deficit",
      amountPercent: 5,
      expectedUsedPercent: 93,
      projectedUsedPercentAtReset: null,
      projectedRemainingPercentAtReset: null,
      runsOutIn: "3h 11m",
      lastsUntilReset: false,
      raw: "5% in deficit | Expected 93% used | Runs out in 3h 11m"
    });
  });

  it("parses reserve pace lines", () => {
    expect(
      parsePaceLine("Pace: 8% in reserve | Expected 55% used | Lasts until reset")
    ).toMatchObject({
      status: "reserve",
      amountPercent: 8,
      expectedUsedPercent: 55,
      runsOutIn: null,
      lastsUntilReset: true
    });
  });

  it("aggregates daily model breakdowns", () => {
    const normalized = normalizeCostResult("codex", {
      daily: [
        {
          date: "2026-05-22",
          totalTokens: 10,
          totalCost: 1,
          modelBreakdowns: [
            {
              modelName: "gpt-5.5",
              totalTokens: 7,
              cost: 0.7
            }
          ]
        },
        {
          date: "2026-05-23",
          totalTokens: 20,
          totalCost: 2,
          modelBreakdowns: [
            {
              modelName: "gpt-5.5",
              totalTokens: 8,
              cost: 0.8
            },
            {
              modelName: "gpt-5.4",
              totalTokens: 12,
              cost: 1.2
            }
          ]
        }
      ]
    });

    expect(normalized?.modelBreakdowns).toEqual([
      {
        modelName: "gpt-5.5",
        totalTokens: 15,
        cost: 1.5
      },
      {
        modelName: "gpt-5.4",
        totalTokens: 12,
        cost: 1.2
      }
    ]);
  });

  it("derives pace when text output has no Pace line", () => {
    const pace = derivePaceFromWindows(
      [
        {
          label: "Weekly",
          usedPercent: 40,
          remainingPercent: 60,
          resetsAt: "2026-05-08T00:00:00.000Z",
          resetDescription: null,
          windowMinutes: 10080,
          pace: parsePaceLine("")
        }
      ],
      new Date("2026-05-04T12:00:00.000Z")
    );

    expect(pace).toMatchObject({
      status: "reserve",
      amountPercent: 10,
      expectedUsedPercent: 50,
      projectedUsedPercentAtReset: 80,
      projectedRemainingPercentAtReset: 20,
      lastsUntilReset: true
    });
  });
});

import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const CODEXBAR_PATH = process.env.CODEXBAR_PATH || `${process.env.HOME}/.local/bin/codexbar`;
const PROVIDERS = ["claude", "codex"] as const;
const CACHE_FILE_PATH = join(process.cwd(), "data", "usage-cache.json");
const CACHE_TTL_MS = 5 * 60 * 1000;

let refreshPromise: Promise<UsageDashboardPayload> | null = null;

type ProviderId = (typeof PROVIDERS)[number];

export type UsageWindow = {
  label: string;
  usedPercent: number;
  remainingPercent: number;
  resetsAt: string | null;
  resetDescription: string | null;
  windowMinutes: number | null;
  pace: UsagePace;
};

export type PaceStatus = "deficit" | "reserve" | "neutral" | "unknown";

export type UsagePace = {
  status: PaceStatus;
  amountPercent: number | null;
  expectedUsedPercent: number | null;
  projectedUsedPercentAtReset: number | null;
  projectedRemainingPercentAtReset: number | null;
  runsOutIn: string | null;
  lastsUntilReset: boolean;
  raw: string | null;
};

export type DailyUsage = {
  date: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  totalCost: number;
  modelBreakdowns: ModelBreakdown[];
};

export type ModelBreakdown = {
  modelName: string;
  totalTokens: number;
  cost: number;
};

export type ProviderUsage = {
  provider: ProviderId;
  label: string;
  source: string | null;
  account: string | null;
  plan: string | null;
  updatedAt: string | null;
  windows: UsageWindow[];
  pace: UsagePace;
  creditsRemaining: number | null;
  cost: {
    historyDays: number | null;
    last30DaysCostUSD: number | null;
    last30DaysTokens: number | null;
    sessionCostUSD: number | null;
    sessionTokens: number | null;
    totals: TokenTotals;
    daily: DailyUsage[];
    modelBreakdowns: ModelBreakdown[];
  } | null;
  error: string | null;
};

export type TokenTotals = {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  totalCost: number;
};

export type UsageDashboardPayload = {
  generatedAt: string;
  providers: ProviderUsage[];
  capabilityNotes: string[];
  cache: {
    status: "fresh" | "stale" | "empty" | "refreshing";
    ageSeconds: number | null;
    refreshStarted: boolean;
  };
};

type RawUsageResult = {
  provider?: string;
  source?: string;
  account?: string;
  version?: string;
  credits?: {
    remaining?: unknown;
  };
  error?: {
    message?: string;
  };
  usage?: {
    accountEmail?: string;
    loginMethod?: string;
    identity?: {
      accountEmail?: string;
      providerID?: string;
    };
    primary?: RawUsageWindow | null;
    secondary?: RawUsageWindow | null;
    tertiary?: RawUsageWindow | null;
    updatedAt?: string;
  };
};

type RawUsageWindow = {
  resetDescription?: string;
  resetsAt?: string;
  usedPercent?: unknown;
  windowMinutes?: unknown;
};

type RawCostResult = {
  provider?: string;
  error?: {
    message?: string;
  };
  daily?: Array<{
    date?: string;
    inputTokens?: unknown;
    outputTokens?: unknown;
    cacheCreationTokens?: unknown;
    cacheReadTokens?: unknown;
    totalTokens?: unknown;
    totalCost?: unknown;
    modelBreakdowns?: Array<{
      modelName?: string;
      totalTokens?: unknown;
      cost?: unknown;
    }>;
  }>;
  historyDays?: unknown;
  last30DaysCostUSD?: unknown;
  last30DaysTokens?: unknown;
  sessionCostUSD?: unknown;
  sessionTokens?: unknown;
  totals?: Partial<TokenTotals>;
  updatedAt?: string;
};

export async function getUsageDashboard(): Promise<UsageDashboardPayload> {
  const providers = await Promise.all(PROVIDERS.map((provider) => getProviderUsage(provider)));

  return {
    generatedAt: new Date().toISOString(),
    providers,
    capabilityNotes: [
      "Linux CLI source exposes current session and weekly limits for Claude and Codex.",
      "Local cost scans expose historical daily cost, token totals, and model breakdowns.",
      "CodexBar web source can expose richer Codex breakdowns on macOS, but reports unsupported on this Linux host."
    ],
    cache: {
      status: "fresh",
      ageSeconds: 0,
      refreshStarted: false
    }
  };
}

export async function getCachedUsageDashboard(): Promise<UsageDashboardPayload> {
  const cached = await readCachedUsageDashboard();

  if (!cached) {
    startUsageRefresh();

    return createEmptyUsageDashboard(true);
  }

  const ageSeconds = getCacheAgeSeconds(cached.generatedAt);
  const isStale = ageSeconds === null || ageSeconds > CACHE_TTL_MS / 1000;
  const refreshStarted = isStale ? startUsageRefresh() : false;

  return {
    ...cached,
    cache: {
      status: refreshStarted ? "refreshing" : isStale ? "stale" : "fresh",
      ageSeconds,
      refreshStarted
    }
  };
}

export async function refreshUsageDashboardCache(): Promise<UsageDashboardPayload> {
  if (!refreshPromise) {
    refreshPromise = getUsageDashboard()
      .then(async (payload) => mergeWithCachedUsageDashboard(payload))
      .then(async (payload) => {
        await persistUsageDashboard(payload);
        return payload;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

export function parsePaceLine(text: string): UsagePace {
  const paceMatch = text.match(/Pace:\s*(.+)/i);
  const raw = paceMatch?.[1]?.trim() ?? null;

  if (!raw) {
    return createEmptyPace();
  }

  const deficit = raw.match(/(\d+(?:\.\d+)?)%\s+in deficit/i);
  const reserve = raw.match(/(\d+(?:\.\d+)?)%\s+in reserve/i);
  const expected = raw.match(/Expected\s+(\d+(?:\.\d+)?)%\s+used/i);
  const runsOut = raw.match(/Runs out in\s+([^|]+)/i);
  const lastsUntilReset = /Lasts until reset/i.test(raw);

  return {
    status: deficit ? "deficit" : reserve ? "reserve" : "neutral",
    amountPercent: numberOrNull(deficit?.[1] ?? reserve?.[1]),
    expectedUsedPercent: numberOrNull(expected?.[1]),
    projectedUsedPercentAtReset: null,
    projectedRemainingPercentAtReset: null,
    runsOutIn: runsOut?.[1]?.trim() ?? null,
    lastsUntilReset,
    raw
  };
}

export function normalizeCostResult(provider: ProviderId, raw: RawCostResult | null) {
  if (!raw || raw.error) {
    return null;
  }

  const daily = (raw.daily ?? []).map(normalizeDailyUsage).filter((entry) => entry.date);
  const modelBreakdowns = aggregateModelBreakdowns(daily);

  return {
    historyDays: numberOrNull(raw.historyDays),
    last30DaysCostUSD: numberOrNull(raw.last30DaysCostUSD),
    last30DaysTokens: numberOrNull(raw.last30DaysTokens),
    sessionCostUSD: numberOrNull(raw.sessionCostUSD),
    sessionTokens: numberOrNull(raw.sessionTokens),
    totals: {
      inputTokens: numberOrZero(raw.totals?.inputTokens),
      outputTokens: numberOrZero(raw.totals?.outputTokens),
      cacheCreationTokens: numberOrZero(raw.totals?.cacheCreationTokens),
      cacheReadTokens: numberOrZero(raw.totals?.cacheReadTokens),
      totalTokens: numberOrZero(raw.totals?.totalTokens),
      totalCost: numberOrZero(raw.totals?.totalCost)
    },
    daily,
    modelBreakdowns
  };
}

async function getProviderUsage(provider: ProviderId): Promise<ProviderUsage> {
  const usageResult = await runCodexBar(
    ["usage", "--provider", provider, "--source", "cli", "--format", "json"],
    30000
  );
  const costResult = await runCodexBar(["cost", "--provider", provider, "--format", "json"], 30000);

  const rawUsage = parseFirstJson<RawUsageResult>(usageResult.stdout);
  const rawCost = parseFirstJson<RawCostResult>(costResult.stdout);
  const error = usageResult.error ?? rawUsage?.error?.message ?? null;
  const usage = rawUsage?.usage;
  const windows = [
    normalizeUsageWindow("Session", usage?.primary),
    normalizeUsageWindow("Weekly", usage?.secondary),
    normalizeUsageWindow("Reserve", usage?.tertiary)
  ].filter((window) => window.windowMinutes !== null || window.resetsAt !== null);

  return {
    provider,
    label: provider === "claude" ? "Claude" : "Codex",
    source: rawUsage?.source ?? null,
    account: usage?.accountEmail ?? usage?.identity?.accountEmail ?? rawUsage?.account ?? null,
    plan: usage?.loginMethod ? titleCase(usage.loginMethod) : null,
    updatedAt: usage?.updatedAt ?? rawCost?.updatedAt ?? null,
    windows,
    pace: derivePaceFromWindows(windows),
    creditsRemaining: numberOrNull(rawUsage?.credits?.remaining),
    cost: normalizeCostResult(provider, rawCost),
    error
  };
}

export function derivePaceFromWindows(windows: UsageWindow[], now = new Date()): UsagePace {
  const window = windows.find((item) => item.label === "Weekly") ?? windows[0];

  return window ? derivePaceFromWindow(window, now) : createEmptyPace();
}

export function derivePaceFromWindow(window: UsageWindow, now = new Date()): UsagePace {
  if (!window.resetsAt || !window.windowMinutes || window.usedPercent <= 0) {
    return createEmptyPace();
  }

  const resetTime = new Date(window.resetsAt).getTime();
  const windowMs = window.windowMinutes * 60 * 1000;
  const startTime = resetTime - windowMs;
  const elapsedRatio = (now.getTime() - startTime) / windowMs;

  if (!Number.isFinite(elapsedRatio) || elapsedRatio <= 0 || elapsedRatio >= 1) {
    return createEmptyPace();
  }

  const expectedUsedPercent = clampPercent(elapsedRatio * 100);
  const difference = window.usedPercent - expectedUsedPercent;
  const remainingPercent = 100 - window.usedPercent;
  const usageRatePerMs = window.usedPercent / (now.getTime() - startTime);
  const runsOutAt = now.getTime() + remainingPercent / usageRatePerMs;
  const lastsUntilReset = runsOutAt >= resetTime;
  const projectedUsedPercentAtReset = Math.round(window.usedPercent + usageRatePerMs * (resetTime - now.getTime()));
  const projectedRemainingPercentAtReset = Math.round(100 - projectedUsedPercentAtReset);
  const status =
    Math.abs(difference) < 1 ? "neutral" : difference > 0 && !lastsUntilReset ? "deficit" : "reserve";
  const runsOutIn = status === "deficit" ? formatDuration(runsOutAt - now.getTime()) : null;
  const amountPercent = Math.round(Math.abs(difference));
  const expectedRounded = Math.round(expectedUsedPercent);

  return {
    status,
    amountPercent,
    expectedUsedPercent: expectedRounded,
    projectedUsedPercentAtReset,
    projectedRemainingPercentAtReset,
    runsOutIn,
    lastsUntilReset,
    raw:
      status === "deficit"
        ? `Projected ${projectedUsedPercentAtReset}% at reset | Runs out in ${runsOutIn}`
        : status === "reserve"
          ? `Projected ${projectedUsedPercentAtReset}% at reset | ${Math.max(projectedRemainingPercentAtReset, 0)}% buffer`
          : `Projected ${projectedUsedPercentAtReset}% at reset | On pace`
  };
}

async function mergeWithCachedUsageDashboard(payload: UsageDashboardPayload) {
  const cached = await readCachedUsageDashboard();

  if (!cached) {
    return payload;
  }

  const providers = payload.providers.map((provider) => {
    const previous = cached.providers.find((item) => item.provider === provider.provider);

    if (!previous) {
      return provider;
    }

    return {
      ...provider,
      account: provider.account ?? previous.account,
      plan: provider.plan ?? previous.plan,
      windows: provider.windows.length > 0 ? provider.windows : previous.windows,
      pace: provider.pace.status === "unknown" ? previous.pace : provider.pace,
      creditsRemaining: provider.creditsRemaining ?? previous.creditsRemaining,
      cost: provider.cost ?? previous.cost,
      error: provider.error
    };
  });

  return {
    ...payload,
    providers
  };
}

function startUsageRefresh() {
  if (refreshPromise) {
    return false;
  }

  refreshPromise = refreshUsageDashboardCache().finally(() => {
    refreshPromise = null;
  });
  void refreshPromise;

  return true;
}

async function readCachedUsageDashboard() {
  try {
    const contents = await readFile(CACHE_FILE_PATH, "utf8");
    const payload = JSON.parse(contents) as UsageDashboardPayload;

    if (!Array.isArray(payload.providers)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

async function persistUsageDashboard(payload: UsageDashboardPayload) {
  await mkdir(dirname(CACHE_FILE_PATH), { recursive: true });
  await writeFile(CACHE_FILE_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function createEmptyUsageDashboard(refreshStarted: boolean): UsageDashboardPayload {
  return {
    generatedAt: new Date().toISOString(),
    providers: [],
    capabilityNotes: [
      "Usage cache is warming. Live CodexBar collection can take 10-30 seconds, so this page renders cached data first."
    ],
    cache: {
      status: refreshStarted ? "refreshing" : "empty",
      ageSeconds: null,
      refreshStarted
    }
  };
}

function getCacheAgeSeconds(generatedAt: string) {
  const generatedTime = new Date(generatedAt).getTime();

  if (!Number.isFinite(generatedTime)) {
    return null;
  }

  return Math.max(0, Math.round((Date.now() - generatedTime) / 1000));
}

async function runCodexBar(args: string[], timeout: number) {
  try {
    const { stdout, stderr } = await execFileAsync(CODEXBAR_PATH, args, {
      timeout,
      maxBuffer: 1024 * 1024 * 8
    });

    return { stdout, stderr, error: null };
  } catch (error) {
    const details = error as { stdout?: string; stderr?: string; message?: string };

    return {
      stdout: details.stdout ?? "",
      stderr: details.stderr ?? "",
      error: details.message ?? "CodexBar command failed"
    };
  }
}

function parseFirstJson<T>(stdout: string): T | null {
  try {
    const parsed = JSON.parse(stdout) as unknown;

    if (Array.isArray(parsed)) {
      return (parsed[0] ?? null) as T | null;
    }

    return parsed as T;
  } catch {
    return null;
  }
}

function normalizeUsageWindow(label: string, window?: RawUsageWindow | null): UsageWindow {
  const usedPercent = clampPercent(numberOrZero(window?.usedPercent));
  const normalized = {
    label,
    usedPercent,
    remainingPercent: clampPercent(100 - usedPercent),
    resetsAt: window?.resetsAt ?? null,
    resetDescription: window?.resetDescription ?? null,
    windowMinutes: numberOrNull(window?.windowMinutes),
    pace: createEmptyPace()
  };

  return {
    ...normalized,
    pace: derivePaceFromWindow(normalized)
  };
}

function normalizeDailyUsage(entry: NonNullable<RawCostResult["daily"]>[number]): DailyUsage {
  return {
    date: entry.date ?? "",
    inputTokens: numberOrZero(entry.inputTokens),
    outputTokens: numberOrZero(entry.outputTokens),
    cacheCreationTokens: numberOrZero(entry.cacheCreationTokens),
    cacheReadTokens: numberOrZero(entry.cacheReadTokens),
    totalTokens: numberOrZero(entry.totalTokens),
    totalCost: numberOrZero(entry.totalCost),
    modelBreakdowns: (entry.modelBreakdowns ?? []).map((model) => ({
      modelName: model.modelName ?? "unknown",
      totalTokens: numberOrZero(model.totalTokens),
      cost: numberOrZero(model.cost)
    }))
  };
}

function aggregateModelBreakdowns(daily: DailyUsage[]) {
  const models = new Map<string, ModelBreakdown>();

  for (const day of daily) {
    for (const model of day.modelBreakdowns) {
      const current = models.get(model.modelName) ?? {
        modelName: model.modelName,
        totalTokens: 0,
        cost: 0
      };

      current.totalTokens += model.totalTokens;
      current.cost += model.cost;
      models.set(model.modelName, current);
    }
  }

  return [...models.values()].sort((a, b) => b.totalTokens - a.totalTokens);
}

function createEmptyPace(): UsagePace {
  return {
    status: "unknown",
    amountPercent: null,
    expectedUsedPercent: null,
    projectedUsedPercentAtReset: null,
    projectedRemainingPercentAtReset: null,
    runsOutIn: null,
    lastsUntilReset: false,
    raw: null
  };
}

function numberOrZero(value: unknown) {
  return numberOrNull(value) ?? 0;
}

function numberOrNull(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;

  return Number.isFinite(parsed) ? parsed : null;
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function titleCase(value: string) {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function formatDuration(ms: number) {
  const totalMinutes = Math.max(1, Math.round(ms / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }

  if (hours <= 0) {
    return `${minutes}m`;
  }

  return `${hours}h ${minutes}m`;
}

"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Cpu, RefreshCw, TrendingUp } from "lucide-react";

import type { ProviderUsage, UsageDashboardPayload, UsageWindow } from "@/lib/usage";

type UsageState =
  | {
      status: "loading";
      data: null;
    }
  | {
      status: "ready";
      data: UsageDashboardPayload;
    }
  | {
      status: "error";
      data: null;
    };

const PROVIDER_ACCENTS: Record<string, string> = {
  claude: "bg-[#e3a15a]",
  codex: "bg-[#67b7a4]"
};

export default function ClaudexUsage() {
  const [state, setState] = useState<UsageState>({
    status: "loading",
    data: null
  });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadUsage = async (forceRefresh = false) => {
      try {
        const response = await fetch(forceRefresh ? "/api/usage?refresh=1" : "/api/usage", {
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error("Failed to load usage");
        }

        const payload = (await response.json()) as UsageDashboardPayload;

        if (!cancelled) {
          setState({
            status: "ready",
            data: payload
          });
        }
      } catch {
        if (!cancelled) {
          setState({
            status: "error",
            data: null
          });
        }
      }
    };

    void loadUsage();

    const intervalId = window.setInterval(() => {
      void loadUsage();
    }, 5 * 60 * 1000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  if (state.status === "loading") {
    return <UsageSkeleton />;
  }

  if (state.status === "error") {
    return (
      <section className="w-full max-w-5xl py-12 text-center">
        <AlertTriangle className="mx-auto h-5 w-5 text-zinc-600" strokeWidth={1.5} aria-hidden="true" />
        <p className="mt-4 text-sm font-light text-zinc-500">usage unavailable</p>
      </section>
    );
  }

  const cacheLabel = getCacheLabel(state.data);

  const handleRefresh = async () => {
    setRefreshing(true);

    try {
      const response = await fetch("/api/usage?refresh=1", {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error("Failed to refresh usage");
      }

      const payload = (await response.json()) as UsageDashboardPayload;
      setState({
        status: "ready",
        data: payload
      });
    } catch {
      setState({
        status: "error",
        data: null
      });
    } finally {
      setRefreshing(false);
    }
  };

  const controls = (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => void handleRefresh()}
        disabled={refreshing}
        className="flex h-11 items-center gap-2 self-start text-xs font-light text-zinc-600 transition-colors duration-200 hover:text-zinc-300 focus-visible:outline-none disabled:text-zinc-800 sm:self-auto"
      >
        <RefreshCw
          className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
          strokeWidth={1.5}
          aria-hidden="true"
        />
        {refreshing ? "refreshing" : cacheLabel}
      </button>
    </div>
  );

  return <DesktopUsageView data={state.data} controls={controls} />;
}

function DesktopUsageView({
  data,
  controls
}: {
  data: UsageDashboardPayload;
  controls: React.ReactNode;
}) {
  const providers = data.providers;
  const combinedDaily = combineDaily(providers);
  const best = chooseBestProvider(providers);

  return (
    <section className="w-full max-w-[104rem] py-8">
      <header className="mb-6 flex flex-col gap-4 text-left xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-light uppercase tracking-[0.2em] text-zinc-700">claudex usage</p>
          <h1 className="mt-3 text-4xl font-light text-zinc-100">Limits &amp; Pace</h1>
        </div>
        {controls}
      </header>

      {providers.length === 0 ? (
        <CacheWarming notes={data.capabilityNotes} />
      ) : (
        <>
          <section className="grid gap-5 xl:grid-cols-2">
            {providers.map((provider) => (
              <HybridProviderPanel key={provider.provider} provider={provider} />
            ))}
          </section>

          <section className="mt-5 grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
            <div className="border border-zinc-900/90 bg-zinc-950/20 p-6">
              <p className="text-xs font-light uppercase tracking-[0.2em] text-zinc-700">best tool now</p>
              <p className="mt-5 text-4xl font-light text-zinc-100">{best.label}</p>
              <p className="mt-3 text-sm font-light leading-6 text-zinc-600">{best.reason}</p>
              <div className="mt-8 grid gap-3">
                {providers.map((provider) => (
                  <ProviderMiniComparison key={`${provider.provider}-comparison`} provider={provider} />
                ))}
              </div>
            </div>

            <div className="border border-zinc-900/90 bg-zinc-950/20 p-6">
              <div className="mb-5 flex items-center justify-between">
                <p className="text-xs font-light uppercase tracking-[0.2em] text-zinc-700">usage rate</p>
                <p className="text-xs font-light text-zinc-700">sqrt scale · last {combinedDaily.length} days</p>
              </div>
              <DailyUsageChart days={combinedDaily} />
            </div>
          </section>

          <section className="mt-5 grid gap-5 xl:grid-cols-[1fr_1fr_0.8fr]">
            {providers.map((provider) => (
              <DesktopModelPanel key={`${provider.provider}-desktop-models`} provider={provider} />
            ))}
            <div className="border border-zinc-900/90 bg-zinc-950/20 p-6">
              <p className="text-xs font-light uppercase tracking-[0.2em] text-zinc-700">token mix</p>
              <TokenMix providers={providers} />
            </div>
          </section>
        </>
      )}
    </section>
  );
}

function HybridProviderPanel({ provider }: { provider: ProviderUsage }) {
  const session = provider.windows.find((window) => window.label === "Session");
  const weekly = provider.windows.find((window) => window.label === "Weekly");
  const forecast = getForecastText(provider);

  return (
    <section className="border border-zinc-900/90 bg-zinc-950/20 p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className={`h-2 w-2 ${PROVIDER_ACCENTS[provider.provider] ?? "bg-zinc-500"}`} />
            <h2 className="text-2xl font-light text-zinc-100">{provider.label}</h2>
          </div>
          <p className="mt-2 text-xs font-light text-zinc-700">
            {[provider.source, provider.plan].filter(Boolean).join(" · ") || "local"}
          </p>
        </div>
        <div className="text-right">
          <p className={forecast.statusClass}>{forecast.primary}</p>
          <p className="mt-1 max-w-52 text-xs font-light leading-5 text-zinc-700">{forecast.secondary}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {session ? <RadialWindow window={session} /> : null}
        {weekly ? <RadialWindow window={weekly} /> : null}
      </div>

      <div className="mt-6 grid gap-4">
        {session ? <WindowDetailLine window={session} primary /> : null}
        {weekly ? <WindowDetailLine window={weekly} /> : null}
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3 text-center">
        <Metric label="30d cost" value={formatMoney(provider.cost?.last30DaysCostUSD)} />
        <Metric label="30d tokens" value={formatCompact(provider.cost?.last30DaysTokens)} />
        <Metric label="today" value={formatMoney(provider.cost?.sessionCostUSD)} />
      </div>
    </section>
  );
}

function WindowDetailLine({ window, primary = false }: { window: UsageWindow; primary?: boolean }) {
  const limitForecast = getLimitForecast(window);
  const ForecastIcon = limitForecast.status === "risk" ? TrendingUp : CheckCircle2;
  const pace = getSafePace(window);
  const runsOutIn = pace.runsOutIn ? formatRunoutDuration(pace.runsOutIn) : null;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-4 text-xs font-light">
        <span className="text-zinc-500">{window.label}</span>
        <span className={`flex items-center gap-1 ${limitForecast.status === "risk" ? "text-[#e3a15a]" : "text-[#67b7a4]"}`}>
          <ForecastIcon className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />
          {limitForecast.label}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-light text-zinc-700">
        <span>{primary ? formatSessionReset(window.resetsAt) : formatLongReset(window.resetsAt)}</span>
        {primary && runsOutIn ? <span>runs out in {runsOutIn}</span> : null}
      </div>
      <div className="mt-2 h-1.5 bg-zinc-900">
        <div className="h-full bg-zinc-500" style={{ width: `${window.usedPercent}%` }} />
      </div>
    </div>
  );
}

function ProviderMiniComparison({ provider }: { provider: ProviderUsage }) {
  const session = provider.windows.find((window) => window.label === "Session");
  const weekly = provider.windows.find((window) => window.label === "Weekly");

  return (
    <div className="grid grid-cols-[5rem_1fr_4rem] items-center gap-3 text-xs font-light">
      <span className="text-zinc-400">{provider.label}</span>
      <div className="h-2 bg-zinc-900">
        <div className="h-full bg-zinc-500" style={{ width: `${session?.remainingPercent ?? 0}%` }} />
      </div>
      <span className="text-right tabular-nums text-zinc-700">{Math.round(weekly?.remainingPercent ?? 0)}% wk</span>
    </div>
  );
}

function DesktopModelPanel({ provider }: { provider: ProviderUsage }) {
  const models = provider.cost?.modelBreakdowns ?? [];
  const maxTokens = Math.max(...models.map((model) => model.totalTokens), 1);

  return (
    <section className="border border-zinc-900/90 bg-zinc-950/20 p-6">
      <div className="mb-5 flex items-center justify-between">
        <p className="text-xs font-light uppercase tracking-[0.2em] text-zinc-700">{provider.label} models</p>
        <Cpu className="h-4 w-4 text-zinc-700" strokeWidth={1.5} aria-hidden="true" />
      </div>
      <div className="space-y-5">
        {models.slice(0, 4).map((model) => (
          <div key={model.modelName}>
            <div className="mb-2 flex items-center justify-between gap-4 text-xs font-light">
              <span className="truncate text-zinc-400">{model.modelName}</span>
              <span className="text-zinc-700">{formatMoney(model.cost)} · {formatCompact(model.totalTokens)}</span>
            </div>
            <div className="h-3 bg-zinc-900">
              <div className="h-full bg-zinc-500" style={{ width: `${Math.max((model.totalTokens / maxTokens) * 100, 2)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CacheWarming({ notes }: { notes: string[] }) {
  return (
    <section className="border border-zinc-900/90 bg-zinc-950/20 p-8 text-center">
      <RefreshCw className="mx-auto h-5 w-5 animate-spin text-zinc-700" strokeWidth={1.5} aria-hidden="true" />
      <p className="mt-5 text-lg font-light text-zinc-300">warming usage cache</p>
      <p className="mx-auto mt-3 max-w-md text-sm font-light leading-6 text-zinc-700">
        First collection can take 10-30 seconds. Future opens render cached usage immediately.
      </p>
      <div className="mx-auto mt-8 grid max-w-3xl gap-2 text-left text-xs font-light leading-5 text-zinc-700 md:grid-cols-3">
        {notes.map((note) => (
          <p key={note}>{note}</p>
        ))}
      </div>
    </section>
  );
}

function RadialWindow({ window }: { window: UsageWindow }) {
  const used = Math.round(window.usedPercent);

  return (
    <div className="flex flex-col items-center">
      <div
        className="grid h-32 w-32 place-items-center rounded-full"
        style={{
          background: `conic-gradient(rgb(212 212 216 / 0.82) ${used * 3.6}deg, rgb(39 39 42 / 0.7) 0deg)`
        }}
        aria-label={`${window.label} ${used}% used`}
      >
        <div className="grid h-24 w-24 place-items-center rounded-full bg-[#111111]">
          <div className="text-center">
            <p className="text-3xl font-light tabular-nums text-zinc-100">{used}%</p>
            <p className="mt-1 text-[10px] font-light uppercase tracking-[0.18em] text-zinc-700">used</p>
          </div>
        </div>
      </div>
      <p className="mt-3 text-sm font-light text-zinc-400">{window.label}</p>
    </div>
  );
}

function TokenMix({ providers }: { providers: ProviderUsage[] }) {
  const totals = providers.reduce(
    (accumulator, provider) => {
      const totals = provider.cost?.totals;

      accumulator.inputTokens += totals?.inputTokens ?? 0;
      accumulator.outputTokens += totals?.outputTokens ?? 0;
      accumulator.cacheCreationTokens += totals?.cacheCreationTokens ?? 0;
      accumulator.cacheReadTokens += totals?.cacheReadTokens ?? 0;

      return accumulator;
    },
    {
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0
    }
  );
  const total =
    totals.inputTokens + totals.outputTokens + totals.cacheCreationTokens + totals.cacheReadTokens || 1;
  const slices = [
    ["input", totals.inputTokens, "bg-zinc-300"],
    ["output", totals.outputTokens, "bg-zinc-500"],
    ["cache write", totals.cacheCreationTokens, "bg-zinc-700"],
    ["cache read", totals.cacheReadTokens, "bg-zinc-800"]
  ] as const;

  return (
    <div className="mt-8">
      <div className="flex h-3 overflow-hidden bg-zinc-900">
        {slices.map(([label, value, color]) => (
          <div
            key={label}
            className={color}
            style={{ width: `${Math.max((value / total) * 100, value > 0 ? 1 : 0)}%` }}
          />
        ))}
      </div>
      <div className="mt-6 grid gap-3">
        {slices.map(([label, value, color]) => (
          <div key={label} className="flex items-center justify-between gap-4 text-xs font-light">
            <span className="flex items-center gap-2 text-zinc-500">
              <span className={`h-2 w-2 ${color}`} />
              {label}
            </span>
            <span className="text-zinc-700">{formatCompact(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DailyUsageChart({ days }: { days: Array<{ date: string; totalTokens: number; totalCost: number }> }) {
  const maxTokens = Math.max(...days.map((day) => day.totalTokens), 1);
  const scaleMax = Math.sqrt(maxTokens);
  const guideValues = [0.25, 0.5, 0.75, 1].map((ratio) => Math.round(maxTokens * ratio * ratio));

  return (
    <div>
      <div className="relative h-64 border-l border-b border-zinc-900/90 pl-4">
        <div className="absolute inset-y-0 left-4 right-0 flex flex-col justify-between">
          {guideValues.slice().reverse().map((value) => (
            <div key={value} className="flex items-center gap-3">
              <span className="w-10 text-right text-[10px] font-light tabular-nums text-zinc-800">
                {formatCompact(value)}
              </span>
              <span className="h-px flex-1 bg-zinc-900/80" />
            </div>
          ))}
        </div>
        <div className="relative z-10 ml-14 flex h-full items-end gap-2">
          {days.map((day) => {
            const height = Math.max((Math.sqrt(day.totalTokens) / scaleMax) * 100, day.totalTokens > 0 ? 4 : 0);

            return (
              <div key={day.date} className="flex h-full flex-1 flex-col justify-end gap-2" title={`${day.date}: ${formatCompact(day.totalTokens)} tokens`}>
                <div className="flex min-h-1 flex-col justify-end bg-zinc-900/45">
                  <div
                    className="bg-zinc-400/80"
                    style={{
                      height: `${height}%`
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="ml-[4.5rem] mt-2 flex justify-between text-[10px] font-light text-zinc-800">
        {days.filter((_, index) => index % Math.ceil(Math.max(days.length, 1) / 6) === 0).map((day) => (
          <span key={day.date}>{new Date(`${day.date}T00:00:00Z`).getUTCDate()}</span>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-zinc-900/80 py-3">
      <p className="text-base font-light tabular-nums text-zinc-300">{value}</p>
      <p className="mt-1 text-[10px] font-light uppercase tracking-[0.18em] text-zinc-700">{label}</p>
    </div>
  );
}

function UsageSkeleton() {
  return (
    <section className="w-full max-w-[92rem] py-10">
      <div className="mb-8 h-10 w-64 animate-pulse bg-zinc-900" />
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="h-80 animate-pulse border border-zinc-900 bg-zinc-950/20" />
        <div className="h-80 animate-pulse border border-zinc-900 bg-zinc-950/20" />
      </div>
    </section>
  );
}

function getCacheLabel(data: UsageDashboardPayload) {
  if (data.cache.refreshStarted) {
    return "refreshing cache";
  }

  if (data.cache.ageSeconds === null) {
    return "cache warming";
  }

  if (data.cache.ageSeconds < 60) {
    return "updated now";
  }

  return `updated ${Math.round(data.cache.ageSeconds / 60)}m ago`;
}

function combineDaily(providers: ProviderUsage[]) {
  const byDate = new Map<string, { date: string; totalTokens: number; totalCost: number }>();

  for (const provider of providers) {
    for (const day of provider.cost?.daily ?? []) {
      const current = byDate.get(day.date) ?? {
        date: day.date,
        totalTokens: 0,
        totalCost: 0
      };

      current.totalTokens += day.totalTokens;
      current.totalCost += day.totalCost;
      byDate.set(day.date, current);
    }
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
}

function chooseBestProvider(providers: ProviderUsage[]) {
  const scored = providers
    .map((provider) => {
      const session = provider.windows.find((window) => window.label === "Session")?.remainingPercent ?? 0;
      const weekly = provider.windows.find((window) => window.label === "Weekly")?.remainingPercent ?? 0;
      const riskPenalty = provider.pace.status === "deficit" ? 20 : 0;

      return {
        provider,
        score: session * 0.6 + weekly * 0.4 - riskPenalty
      };
    })
    .sort((a, b) => b.score - a.score);
  const best = scored[0]?.provider;

  if (!best) {
    return {
      label: "No data",
      reason: "Usage cache is still warming."
    };
  }

  const session = best.windows.find((window) => window.label === "Session")?.remainingPercent ?? 0;
  const weekly = best.windows.find((window) => window.label === "Weekly")?.remainingPercent ?? 0;

  return {
    label: best.label,
    reason: `${Math.round(session)}% session and ${Math.round(weekly)}% weekly remaining, adjusted for projected pace.`
  };
}

function getForecastText(provider: ProviderUsage) {
  if (provider.pace.status === "deficit") {
    return {
      primary: "Pace: at risk",
      secondary: formatProviderForecast(provider.pace),
      statusClass: "text-sm font-light text-[#e3a15a]"
    };
  }

  if (provider.pace.status === "reserve") {
    return {
      primary: provider.pace.lastsUntilReset ? "Pace: safe" : "Pace: reserve",
      secondary: formatProviderForecast(provider.pace),
      statusClass: "text-sm font-light text-[#67b7a4]"
    };
  }

  if (provider.pace.status === "neutral") {
    return {
      primary: "Pace: on pace",
      secondary: provider.pace.raw ?? "tracking expected use",
      statusClass: "text-sm font-light text-zinc-400"
    };
  }

  return {
    primary: provider.error ? "Pace: partial" : "Pace: unknown",
    secondary: provider.error ?? "waiting for window timing",
    statusClass: "text-sm font-light text-zinc-500"
  };
}

function getLimitForecast(window: UsageWindow) {
  const pace = getSafePace(window);
  const projected = pace.projectedUsedPercentAtReset;

  if (pace.status === "deficit") {
    return {
      status: "risk",
      label: pace.runsOutIn
        ? `surpasses limit in ${formatRunoutDuration(pace.runsOutIn)}`
        : "surpasses limit before reset"
    };
  }

  if (projected !== null) {
    const buffer = Math.max(0, 100 - projected);

    return {
      status: "safe",
      label: `stays below limit · ${buffer}% buffer`
    };
  }

  return {
    status: "unknown",
    label: "limit forecast unknown"
  };
}

function formatProviderForecast(pace: ReturnType<typeof getSafePace>) {
  if (pace.projectedUsedPercentAtReset !== null) {
    if (pace.status === "deficit") {
      return pace.runsOutIn
        ? `Projected ${pace.projectedUsedPercentAtReset}% at reset | Runs out in ${formatRunoutDuration(pace.runsOutIn)}`
        : `Projected ${pace.projectedUsedPercentAtReset}% at reset`;
    }

    return `Projected ${pace.projectedUsedPercentAtReset}% at reset | ${Math.max(
      pace.projectedRemainingPercentAtReset ?? 0,
      0
    )}% buffer`;
  }

  return pace.raw ? pace.raw.replace(/Runs out in\s+([^|]+)/i, (_, duration: string) => `Runs out in ${formatRunoutDuration(duration.trim())}`) : "limit forecast unavailable";
}

function formatRunoutDuration(value: string) {
  const match = value.match(/(?:(\d+)d\s*)?(?:(\d+)h\s*)?(?:(\d+)m)?/i);

  if (!match) {
    return value;
  }

  const days = Number(match[1] ?? 0);
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);
  const totalMinutes = days * 1440 + hours * 60 + minutes;

  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) {
    return value;
  }

  const normalizedDays = Math.floor(totalMinutes / 1440);
  const normalizedHours = Math.floor((totalMinutes % 1440) / 60);
  const normalizedMinutes = totalMinutes % 60;

  if (normalizedDays > 0) {
    return `${normalizedDays}d ${normalizedHours}h ${normalizedMinutes}m`;
  }

  if (normalizedHours > 0) {
    return `${normalizedHours}h ${normalizedMinutes}m`;
  }

  return `${normalizedMinutes}m`;
}

function getSafePace(window: UsageWindow) {
  return (
    window.pace ?? {
      status: "unknown",
      amountPercent: null,
      expectedUsedPercent: null,
      projectedUsedPercentAtReset: null,
      projectedRemainingPercentAtReset: null,
      runsOutIn: null,
      lastsUntilReset: false,
      raw: null
    }
  );
}

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatReset(value: string | null) {
  if (!value) {
    return "reset unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatSessionReset(value: string | null) {
  if (!value) {
    return "reset unknown";
  }

  const date = new Date(value);

  return `resets in ${formatDurationUntil(date)} at ${new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit"
  }).format(date)}`;
}

function formatLongReset(value: string | null) {
  if (!value) {
    return "reset unknown";
  }

  return `resets in ${formatDurationUntil(new Date(value))}`;
}

function formatDurationUntil(date: Date) {
  const totalMinutes = Math.max(0, Math.round((date.getTime() - Date.now()) / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}

function formatCompact(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "n/a";
  }

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "n/a";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

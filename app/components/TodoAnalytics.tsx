"use client";

import { useCallback, useEffect, useState } from "react";
import { Check } from "lucide-react";

type TodoItem = {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
  status?: "pushed" | "abandoned";
};

type WeekStats = {
  total: number;
  done: number;
  pushed: number;
  abandoned: number;
  completionRate: number;
};

type EnrichedWeek = {
  week: string;
  weekLabel: string;
  todos: TodoItem[];
  stats: WeekStats;
};

type HistoryResponse = {
  history: EnrichedWeek[];
  needsTriage: EnrichedWeek[];
};

// Per-week local triage state keyed by todo id
type TriageStatus = "pushed" | "abandoned";
type LocalTriage = Record<string, TriageStatus>;

type AnalyticsState =
  | { status: "loading" }
  | { status: "ready"; history: EnrichedWeek[]; needsTriage: EnrichedWeek[] }
  | { status: "error" };

const BAR_WIDTH = 28;
const BAR_MAX_HEIGHT = 80;

export default function TodoAnalytics() {
  const [state, setState] = useState<AnalyticsState>({ status: "loading" });
  // localTriage maps week -> { todoId -> status }
  const [localTriage, setLocalTriage] = useState<Record<string, LocalTriage>>({});
  const [triaging, setTriaging] = useState<Set<string>>(new Set());

  const loadHistory = useCallback(async () => {
    try {
      const response = await fetch("/api/todos/history", { cache: "no-store" });
      if (!response.ok) throw new Error("Failed");
      const data = (await response.json()) as HistoryResponse;
      setState({ status: "ready", history: data.history, needsTriage: data.needsTriage });
    } catch {
      setState({ status: "error" });
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const handleTriageStatus = (week: string, todoId: string, status: TriageStatus) => {
    setLocalTriage((prev) => {
      const weekTriage = { ...(prev[week] ?? {}) };
      // Toggle off if same status clicked again
      if (weekTriage[todoId] === status) {
        delete weekTriage[todoId];
      } else {
        weekTriage[todoId] = status;
      }
      return { ...prev, [week]: weekTriage };
    });
  };

  const handleSubmitTriage = async (enrichedWeek: EnrichedWeek) => {
    const weekTriage = localTriage[enrichedWeek.week] ?? {};
    const updates = Object.entries(weekTriage).map(([id, status]) => ({ id, status }));

    if (updates.length === 0) return;

    setTriaging((prev) => new Set([...prev, enrichedWeek.week]));

    try {
      const response = await fetch("/api/todos/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week: enrichedWeek.week, updates })
      });

      if (!response.ok) throw new Error("Failed");

      // Clear local triage state for this week and reload
      setLocalTriage((prev) => {
        const next = { ...prev };
        delete next[enrichedWeek.week];
        return next;
      });

      await loadHistory();
    } catch {
      // leave triage state as-is so user can retry
    } finally {
      setTriaging((prev) => {
        const next = new Set(prev);
        next.delete(enrichedWeek.week);
        return next;
      });
    }
  };

  if (state.status === "loading") {
    return (
      <section className="w-full">
        <div className="mb-8 h-3 w-48 animate-pulse bg-zinc-900" />
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="animate-pulse bg-zinc-900"
              style={{ width: BAR_WIDTH, height: Math.random() * BAR_MAX_HEIGHT + 10 }}
            />
          ))}
        </div>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="w-full">
        <p className="text-xs font-light uppercase tracking-[0.2em] text-zinc-700">weekly todos</p>
        <p className="mt-4 text-xs font-light text-zinc-600">history unavailable</p>
      </section>
    );
  }

  const { history, needsTriage } = state;
  const last12Weeks = history.slice(-12);
  const maxTotal = Math.max(...last12Weeks.map((w) => w.stats.total), 1);

  // Compute aggregate stats
  const totalWeeks = history.length;
  const avgDone =
    totalWeeks === 0
      ? 0
      : Math.round(history.reduce((sum, w) => sum + w.stats.done, 0) / totalWeeks);
  const totalWritten = history.reduce((sum, w) => sum + w.stats.total, 0);

  return (
    <section className="w-full">
      {/* Triage Panel */}
      {needsTriage.length > 0 && (
        <div className="mb-12">
          {needsTriage.map((week) => {
            const weekTriage = localTriage[week.week] ?? {};
            const incompleteTodos = week.todos.filter((t) => !t.done);
            const allTriaged = incompleteTodos.every((t) => t.status || weekTriage[t.id]);
            const isSubmitting = triaging.has(week.week);

            return (
              <div key={week.week} className="mb-10">
                <p className="text-[10px] font-light uppercase tracking-[0.2em] text-zinc-700">
                  {week.week} · needs review
                </p>
                <p className="mt-2 text-sm font-light text-zinc-400">{week.weekLabel}</p>

                <ul className="mt-6 flex flex-col gap-3">
                  {week.todos.map((todo) => {
                    const localStatus = weekTriage[todo.id];
                    const resolvedStatus = todo.status ?? localStatus;

                    if (todo.done) {
                      return (
                        <li key={todo.id} className="flex items-center gap-3">
                          <Check className="h-3 w-3 shrink-0 text-zinc-700" strokeWidth={1.5} />
                          <span className="text-xs font-light text-zinc-700 line-through">{todo.text}</span>
                        </li>
                      );
                    }

                    return (
                      <li key={todo.id} className="flex items-center gap-3">
                        <span
                          className={`flex-1 text-xs font-light ${
                            resolvedStatus === "pushed"
                              ? "text-zinc-400"
                              : resolvedStatus === "abandoned"
                                ? "text-zinc-800 line-through"
                                : "text-zinc-400"
                          }`}
                        >
                          {todo.text}
                        </span>

                        {!todo.status && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleTriageStatus(week.week, todo.id, "pushed")}
                              className={`text-xs font-light transition-colors duration-200 ${
                                localStatus === "pushed"
                                  ? "text-zinc-300"
                                  : "text-zinc-600 hover:text-zinc-300"
                              }`}
                            >
                              push →
                            </button>
                            <button
                              type="button"
                              onClick={() => handleTriageStatus(week.week, todo.id, "abandoned")}
                              className={`text-xs font-light transition-colors duration-200 ${
                                localStatus === "abandoned"
                                  ? "text-zinc-800 line-through"
                                  : "text-zinc-600 hover:text-zinc-300"
                              }`}
                            >
                              abandon
                            </button>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>

                {allTriaged && (
                  <button
                    type="button"
                    onClick={() => void handleSubmitTriage(week)}
                    disabled={isSubmitting}
                    className="mt-6 text-sm font-light text-zinc-300 transition-colors hover:text-zinc-100 disabled:text-zinc-700"
                  >
                    {isSubmitting ? "saving..." : "done triaging →"}
                  </button>
                )}
              </div>
            );
          })}

          <div className="my-12 h-px w-full max-w-xs bg-zinc-800/50" />
        </div>
      )}

      {/* Weekly Stats Chart */}
      <div>
        <p className="text-[10px] font-light uppercase tracking-[0.2em] text-zinc-700">
          weekly todos · completion
        </p>

        {last12Weeks.length === 0 ? (
          <p className="mt-6 text-xs font-light italic text-zinc-700">no history yet</p>
        ) : (
          <>
            <div className="mt-8 flex items-end gap-1">
              {last12Weeks.map((week) => {
                const { total, done, pushed } = week.stats;
                const barHeight = total === 0 ? 0 : Math.max((total / maxTotal) * BAR_MAX_HEIGHT, 4);
                const doneHeight = total === 0 ? 0 : (done / total) * barHeight;
                const pushedHeight = total === 0 ? 0 : (pushed / total) * barHeight;
                const restHeight = barHeight - doneHeight - pushedHeight;

                const titleText = `${week.weekLabel}: ${done}/${total} done${pushed > 0 ? `, ${pushed} pushed` : ""}${week.stats.abandoned > 0 ? `, ${week.stats.abandoned} abandoned` : ""}`;

                return (
                  <div key={week.week} style={{ width: BAR_WIDTH }} className="flex flex-col items-center">
                    <div
                      className="flex w-full flex-col justify-end"
                      style={{ height: BAR_MAX_HEIGHT }}
                      title={titleText}
                    >
                      {total > 0 && (
                        <div style={{ height: barHeight }} className="flex w-full flex-col justify-end">
                          {doneHeight > 0 && (
                            <div className="w-full bg-zinc-300" style={{ height: doneHeight }} />
                          )}
                          {pushedHeight > 0 && (
                            <div className="w-full bg-zinc-700" style={{ height: pushedHeight }} />
                          )}
                          {restHeight > 0 && (
                            <div className="w-full bg-zinc-900" style={{ height: restHeight }} />
                          )}
                        </div>
                      )}
                    </div>
                    <span className="mt-1 text-[10px] font-light text-zinc-800">
                      {week.week.replace(/^\d{4}-/, "")}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-4 flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-[10px] font-light text-zinc-700">
                <span className="inline-block h-2 w-2 bg-zinc-300" />
                done
              </span>
              <span className="flex items-center gap-1.5 text-[10px] font-light text-zinc-700">
                <span className="inline-block h-2 w-2 bg-zinc-700" />
                pushed
              </span>
              <span className="flex items-center gap-1.5 text-[10px] font-light text-zinc-700">
                <span className="inline-block h-2 w-2 bg-zinc-900 ring-1 ring-zinc-800" />
                not resolved
              </span>
            </div>
          </>
        )}

        {/* Stats line */}
        <p className="mt-8 text-xs font-light text-zinc-700">
          {totalWeeks} {totalWeeks === 1 ? "week" : "weeks"} tracked · {avgDone} avg done · {totalWritten} total written
        </p>
      </div>
    </section>
  );
}

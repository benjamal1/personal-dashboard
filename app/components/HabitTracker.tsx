"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Plus,
  X
} from "lucide-react";

type Habit = {
  id: string;
  name: string;
  createdAt: string;
  archivedAt?: string;
  goal?: number; // undefined or 1 = boolean; > 1 = tiered
};

type HabitData = {
  habits: Habit[];
  completions: Record<string, Record<string, number>>; // date → habitId → count
};

type HabitState =
  | { status: "loading" }
  | { status: "ready"; habits: Habit[]; completions: Record<string, Record<string, number>> }
  | { status: "error" };

// Group consecutive dates by month
type MonthGroup = { month: string; count: number };

function buildMonthGroups(dates: string[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  let current: MonthGroup | null = null;

  for (const date of dates) {
    const monthStr = new Date(`${date}T00:00:00Z`).toLocaleString("en-US", {
      month: "short",
      timeZone: "UTC"
    });
    if (!current || current.month !== monthStr) {
      if (current) groups.push(current);
      current = { month: monthStr, count: 1 };
    } else {
      current.count++;
    }
  }
  if (current) groups.push(current);
  return groups;
}

function getCellClasses(count: number, goal: number, isToday: boolean): string {
  const ring = isToday ? " ring-1 ring-zinc-500" : "";
  if (count === 0) return `bg-zinc-800${ring}`;
  if (goal <= 1) return `bg-zinc-300${ring}`;
  const ratio = count / goal;
  if (ratio >= 1) return `bg-zinc-200${ring}`;
  if (ratio >= 0.67) return `bg-zinc-400${ring}`;
  if (ratio >= 0.34) return `bg-zinc-600${ring}`;
  return `bg-zinc-700${ring}`;
}

/** Offset a YYYY-MM-DD string by N days (UTC-safe) */
function offsetDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

const CELL_SIZE = 12;   // px
const CELL_GAP = 3;     // px between cells
const CELL_STRIDE = CELL_SIZE + CELL_GAP;
const NAME_COL_WIDTH = 148; // px — fixed name column
const WINDOW_SIZE = 28; // visible days at once
const PAN_STEP = 7;     // days per arrow click
const HISTORY_LIMIT = 180; // how far back we can pan
const FUTURE_LIMIT = 14;   // how far ahead we can pan

export default function HabitTracker() {
  const [state, setState] = useState<HabitState>({ status: "loading" });
  const [draft, setDraft] = useState("");
  const [goalDraft, setGoalDraft] = useState("");
  const [addingHabit, setAddingHabit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // windowStart: ISO date of the leftmost visible column
  const [windowStart, setWindowStart] = useState<string>(() =>
    // Default: window ends at today
    offsetDate(todayStr(), -(WINDOW_SIZE - 1))
  );

  const today = todayStr();

  // Earliest and latest allowed windowStart
  const minWindowStart = useMemo(() => offsetDate(today, -HISTORY_LIMIT), [today]);
  const maxWindowStart = useMemo(() => offsetDate(today, FUTURE_LIMIT), [today]);

  // Build the WINDOW_SIZE visible dates from windowStart
  const visibleDates = useMemo(() => {
    return Array.from({ length: WINDOW_SIZE }, (_, i) => offsetDate(windowStart, i));
  }, [windowStart]);

  const monthGroups = useMemo(() => buildMonthGroups(visibleDates), [visibleDates]);

  const todayInView = visibleDates.includes(today);

  const windowLabel = useMemo(() => {
    const fmt = (d: string) =>
      new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC"
      });
    return `${fmt(visibleDates[0])} – ${fmt(visibleDates[visibleDates.length - 1])}`;
  }, [visibleDates]);

  const pan = (days: number) => {
    setWindowStart((prev) => {
      const next = offsetDate(prev, days);
      if (next < minWindowStart) return minWindowStart;
      if (next > maxWindowStart) return maxWindowStart;
      return next;
    });
  };

  const jumpToToday = () => {
    setWindowStart(offsetDate(today, -(WINDOW_SIZE - 1)));
  };

  // ── Data loading ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/habits", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed");
        const data = (await res.json()) as HabitData;
        if (!cancelled) setState({ status: "ready", habits: data.habits, completions: data.completions });
      } catch {
        if (!cancelled) setState({ status: "error" });
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (addingHabit) inputRef.current?.focus();
  }, [addingHabit]);

  // ── Handlers ────────────────────────────────────────────────────
  const handleToggleCell = async (habitId: string, date: string) => {
    if (state.status !== "ready") return;
    const habit = state.habits.find((h) => h.id === habitId);
    const goal = habit?.goal ?? 1;
    const dayMap = state.completions[date] ?? {};
    const currentCount = dayMap[habitId] ?? 0;
    const newCount = (currentCount + 1) % (goal + 1);

    // Optimistic update
    const nextDayMap = { ...dayMap };
    if (newCount === 0) delete nextDayMap[habitId];
    else nextDayMap[habitId] = newCount;

    const nextCompletions = { ...state.completions };
    if (Object.keys(nextDayMap).length === 0) delete nextCompletions[date];
    else nextCompletions[date] = nextDayMap;

    setState((prev) => prev.status === "ready" ? { ...prev, completions: nextCompletions } : prev);

    try {
      const res = await fetch("/api/habits/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ habitId, date })
      });
      if (!res.ok) throw new Error("Failed");
      const result = (await res.json()) as { date: string; completions: Record<string, number> };
      setState((prev) => {
        if (prev.status !== "ready") return prev;
        const updated = { ...prev.completions };
        if (Object.keys(result.completions).length === 0) delete updated[result.date];
        else updated[result.date] = result.completions;
        return { ...prev, completions: updated };
      });
    } catch {
      setState((prev) => prev.status === "ready" ? { ...prev, completions: state.completions } : prev);
    }
  };

  const handleAddHabit = async () => {
    const name = draft.trim();
    if (!name || submitting) return;
    setSubmitting(true);
    const parsedGoal = parseInt(goalDraft, 10);
    const goal = Number.isFinite(parsedGoal) && parsedGoal >= 1 ? parsedGoal : undefined;
    try {
      const res = await fetch("/api/habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, ...(goal !== undefined ? { goal } : {}) })
      });
      if (!res.ok) throw new Error("Failed");
      const result = (await res.json()) as { habits: Habit[] };
      setState((prev) => prev.status === "ready" ? { ...prev, habits: result.habits } : prev);
      setDraft("");
      setGoalDraft("");
      setAddingHabit(false);
    } catch {
      // silently fail — user can retry
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteHabit = async (habit: Habit) => {
    if (!window.confirm(`Delete "${habit.name}"? This removes all completion history.`)) return;
    try {
      const res = await fetch(`/api/habits/${habit.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      setState((prev) => prev.status === "ready"
        ? { ...prev, habits: prev.habits.filter((h) => h.id !== habit.id) }
        : prev
      );
    } catch { /* silent */ }
  };

  const handleMove = async (habitId: string, direction: "up" | "down") => {
    if (state.status !== "ready") return;
    const habits = [...state.habits];
    const idx = habits.findIndex((h) => h.id === habitId);
    if (idx < 0) return;
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= habits.length) return;
    [habits[idx], habits[targetIdx]] = [habits[targetIdx], habits[idx]];
    setState((prev) => prev.status === "ready" ? { ...prev, habits } : prev);
    try {
      await fetch("/api/habits/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: habits.map((h) => h.id) })
      });
    } catch {
      setState((prev) => prev.status === "ready" ? { ...prev, habits: state.habits } : prev);
    }
  };

  // ── Loading / error states ───────────────────────────────────────
  if (state.status === "loading") {
    return (
      <section className="w-full">
        <p className="text-xs font-light uppercase tracking-[0.2em] text-zinc-700">habits</p>
        <div className="mt-6 flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-3 w-28 animate-pulse bg-zinc-900" />
              <div className="h-3 w-64 animate-pulse bg-zinc-900" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="w-full">
        <p className="text-xs font-light uppercase tracking-[0.2em] text-zinc-700">habits</p>
        <p className="mt-4 text-xs font-light text-zinc-600">habits unavailable</p>
      </section>
    );
  }

  const { habits, completions } = state;

  // Header rows: month label (12px) + mt-1 (4px) + day numbers (12px) + mt-2 (8px) = 36px
  const HEADER_H = 36;
  // Arrow button size — must meet 44px touch target
  const ARROW_SIZE = 44;

  return (
    <section className="w-full">
      {/* ── Top bar: kicker + today jump ── */}
      <div className="mb-5 flex items-center justify-between">
        <p className="text-xs font-light uppercase tracking-[0.2em] text-zinc-700">
          habits · {windowLabel}
        </p>
        {!todayInView && (
          <button
            type="button"
            onClick={jumpToToday}
            className="text-[10px] font-light uppercase tracking-[0.15em] text-zinc-600 transition-colors hover:text-zinc-300"
          >
            today
          </button>
        )}
      </div>

      {/* ── Main layout: [names] [‹] [grid] [›] ── */}
      <div className="flex w-full items-start">

        {/* ── LEFT: fixed name column ── */}
        <div className="flex shrink-0 flex-col" style={{ width: NAME_COL_WIDTH }}>
          {/* Spacer aligns with header rows */}
          {habits.length > 0 && <div style={{ height: HEADER_H }} />}

          {habits.length === 0 ? (
            <p className="mt-6 text-xs font-light italic text-zinc-700">
              no habits yet
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {habits.map((habit, index) => (
                <div
                  key={habit.id}
                  className="group flex items-center justify-end gap-1 pr-3"
                  style={{ height: CELL_SIZE }}
                >
                  {/* Reorder up */}
                  <button
                    type="button"
                    onClick={() => void handleMove(habit.id, "up")}
                    disabled={index === 0}
                    className="hidden h-4 w-4 shrink-0 items-center justify-center text-zinc-700 hover:text-zinc-400 disabled:opacity-20 group-hover:flex"
                    aria-label={`Move ${habit.name} up`}
                  >
                    <ChevronUp className="h-3 w-3" strokeWidth={1.5} />
                  </button>
                  {/* Reorder down */}
                  <button
                    type="button"
                    onClick={() => void handleMove(habit.id, "down")}
                    disabled={index === habits.length - 1}
                    className="hidden h-4 w-4 shrink-0 items-center justify-center text-zinc-700 hover:text-zinc-400 disabled:opacity-20 group-hover:flex"
                    aria-label={`Move ${habit.name} down`}
                  >
                    <ChevronDown className="h-3 w-3" strokeWidth={1.5} />
                  </button>
                  {/* Name */}
                  <span className="min-w-0 truncate text-xs font-light leading-none text-zinc-500">
                    {habit.name}
                    {habit.goal && habit.goal > 1 && (
                      <span className="ml-1 text-zinc-700">×{habit.goal}</span>
                    )}
                  </span>
                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => void handleDeleteHabit(habit)}
                    className="ml-1 hidden shrink-0 text-zinc-700 hover:text-zinc-400 group-hover:inline-flex"
                    aria-label={`Delete ${habit.name}`}
                  >
                    <X className="h-3 w-3" strokeWidth={1.5} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add habit — sits below habit rows */}
          <div className="mt-5">
            {addingHabit ? (
              <div className="flex flex-wrap items-center gap-2">
                <Plus className="h-3 w-3 shrink-0 text-zinc-700" strokeWidth={1.5} aria-hidden />
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleAddHabit();
                    if (e.key === "Escape") { setAddingHabit(false); setDraft(""); setGoalDraft(""); }
                  }}
                  placeholder="habit name"
                  disabled={submitting}
                  className="w-24 border-0 border-b border-zinc-800 bg-transparent px-0 py-1 text-xs font-light text-zinc-300 outline-none placeholder:italic placeholder:text-zinc-700"
                  autoComplete="off"
                />
                <span className="text-[10px] font-light text-zinc-700">goal</span>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={goalDraft}
                  onChange={(e) => setGoalDraft(e.target.value)}
                  placeholder="1"
                  disabled={submitting}
                  className="w-8 border-0 border-b border-zinc-800 bg-transparent px-0 py-1 text-center text-xs font-light text-zinc-300 outline-none placeholder:text-zinc-700"
                />
                <button
                  type="button"
                  onClick={() => void handleAddHabit()}
                  disabled={submitting}
                  className="flex h-5 w-5 items-center justify-center text-zinc-600 hover:text-zinc-300 disabled:opacity-40"
                  aria-label="Save habit"
                >
                  <Check className="h-3 w-3" strokeWidth={1.5} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingHabit(true)}
                className="flex items-center gap-2 text-xs font-light text-zinc-700 transition-colors hover:text-zinc-400"
              >
                <Plus className="h-3 w-3" strokeWidth={1.5} aria-hidden />
                add habit
              </button>
            )}
          </div>
        </div>

        {/* ── LEFT ARROW ── */}
        <div className="flex shrink-0 flex-col items-center" style={{ width: ARROW_SIZE }}>
          {/* Spacer so arrow sits alongside the cell rows, not the header */}
          {habits.length > 0 && <div style={{ height: HEADER_H }} />}
          <button
            type="button"
            onClick={() => pan(-PAN_STEP)}
            disabled={windowStart <= minWindowStart}
            className="flex items-center justify-center text-zinc-700 transition-colors hover:text-zinc-300 disabled:opacity-20"
            style={{ width: ARROW_SIZE, height: Math.max(ARROW_SIZE, habits.length * (CELL_SIZE + 8) - 8) || ARROW_SIZE }}
            aria-label="Scroll back 7 days"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* ── GRID ── */}
        <div className="min-w-0 flex-1">
          {/* Month labels */}
          <div className="flex" style={{ height: 12 }}>
            {monthGroups.map((group, i) => (
              <div
                key={`${group.month}-${i}`}
                className="overflow-hidden text-[10px] font-light text-zinc-700"
                style={{ width: group.count * CELL_STRIDE }}
              >
                {group.month}
              </div>
            ))}
          </div>

          {/* Day numbers + today marker */}
          <div className="mt-1 flex" style={{ height: 16 }}>
            {visibleDates.map((date, index) => {
              const isToday = date === today;
              const dayNum = new Date(`${date}T00:00:00Z`).getUTCDate();
              // Always show today; also show on first col, first-of-month, every 7th
              const show = isToday || index === 0 || dayNum === 1 || index % 7 === 0;
              return (
                <div
                  key={date}
                  className="flex shrink-0 flex-col items-center justify-start gap-0.5"
                  style={{ width: CELL_SIZE, marginRight: CELL_GAP }}
                >
                  <span
                    className={`text-[10px] font-light leading-none ${
                      isToday ? "text-zinc-300" : "text-zinc-800"
                    }`}
                  >
                    {show ? dayNum : ""}
                  </span>
                  {isToday && (
                    <span className="block h-1 w-1 rounded-full bg-zinc-500" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Cell rows */}
          {habits.length > 0 && (
            <div className="mt-2 flex flex-col gap-2">
              {habits.map((habit) => (
                <div key={habit.id} className="flex" style={{ height: CELL_SIZE }}>
                  {visibleDates.map((date) => {
                    const count = (completions[date] ?? {})[habit.id] ?? 0;
                    const goal = habit.goal ?? 1;
                    const isToday = date === today;
                    const title = goal > 1 ? `${date}: ${count}/${goal}` : date;
                    return (
                      <button
                        key={date}
                        type="button"
                        onClick={() => void handleToggleCell(habit.id, date)}
                        title={title}
                        aria-label={`${habit.name} ${date}: ${count}/${goal}`}
                        className={`shrink-0 transition-colors duration-100 ${getCellClasses(count, goal, isToday)}`}
                        style={{ width: CELL_SIZE, height: CELL_SIZE, marginRight: CELL_GAP }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── RIGHT ARROW ── */}
        <div className="flex shrink-0 flex-col items-center" style={{ width: ARROW_SIZE }}>
          {habits.length > 0 && <div style={{ height: HEADER_H }} />}
          <button
            type="button"
            onClick={() => pan(PAN_STEP)}
            disabled={windowStart >= maxWindowStart}
            className="flex items-center justify-center text-zinc-700 transition-colors hover:text-zinc-300 disabled:opacity-20"
            style={{ width: ARROW_SIZE, height: Math.max(ARROW_SIZE, habits.length * (CELL_SIZE + 8) - 8) || ARROW_SIZE }}
            aria-label="Scroll forward 7 days"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

      </div>
    </section>
  );
}

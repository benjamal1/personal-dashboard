"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { DigestPaper, RecentNote, TodayDigest } from "@/lib/digest";
import type { IntakeItem, Priority } from "@/lib/digest-shared";
import DigestSubmitBar from "./DigestSubmitBar";
import DigestIntakeSection from "./DigestIntakeSection";
import DigestTodaySection from "./DigestTodaySection";
import DigestRecentSection from "./DigestRecentSection";

const POLL_INTERVAL_MS = 60_000;
const INTAKE_POLL_MS = 15_000;
const TODAY_PAGE = 3;
// Button-only advance: we persist the exact item_ids currently shown (BATCH) and
// the ids already cycled past (SEEN). Picks never rotate on their own — the 5am
// recommender may re-rank the pool, but the shown batch only changes on "cycle".
const BATCH_KEY = "reading-digest-batch";
const SEEN_KEY = "reading-digest-seen";
// obsidian:// links open in the Obsidian app on whatever machine clicks them —
// usually the Mac over Tailscale, where the vault is named "BJ's Obsidian Vault".
const VAULT_NAME = process.env.NEXT_PUBLIC_OBSIDIAN_VAULT ?? "BJ's Obsidian Vault";

type Vote = "up" | "down";

const EMPTY_TODAY: TodayDigest = { date: null, papers: [] };

// The next batch = the first `size` papers (in ranked order) not yet seen.
function pickBatch(papers: DigestPaper[], seen: string[], size: number): string[] {
  const seenSet = new Set(seen);
  return papers
    .filter((paper) => paper.itemId && !seenSet.has(paper.itemId))
    .slice(0, size)
    .map((paper) => paper.itemId as string);
}

export default function ReadingDigest() {
  const [today, setToday] = useState<TodayDigest>(EMPTY_TODAY);
  const [recent, setRecent] = useState<RecentNote[]>([]);
  const [intake, setIntake] = useState<IntakeItem[]>([]);
  const [batchIds, setBatchIds] = useState<string[] | null>(null); // null = not yet seeded
  const [seenIds, setSeenIds] = useState<string[]>([]);
  const [votes, setVotes] = useState<Record<string, Vote>>({});
  const [generating, setGenerating] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const loadIntake = useCallback(async () => {
    try {
      const res = await fetch("/api/digest/intake");
      if (res.ok) {
        setIntake((await res.json()).items ?? []);
      }
    } catch {
      // non-fatal; keep last
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [todayResponse, recentResponse] = await Promise.all([
        fetch("/api/digest/today"),
        fetch("/api/digest/recent")
      ]);
      if (!todayResponse.ok || !recentResponse.ok) {
        throw new Error("bad response");
      }
      setToday(await todayResponse.json());
      setRecent((await recentResponse.json()).notes ?? []);
      setError(null);
    } catch {
      setError("Couldn't reach the digest service — showing the last loaded data.");
    }
    await loadIntake();
  }, [loadIntake]);

  useEffect(() => {
    void refresh();
    const slow = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    // Poll the intake queue more often so live status feels responsive.
    const fast = setInterval(() => void loadIntake(), INTAKE_POLL_MS);
    return () => {
      clearInterval(slow);
      clearInterval(fast);
    };
  }, [refresh, loadIntake]);

  // Restore the persisted batch + seen state once, on mount. Not keyed to the
  // date — that's the whole point: the view must not reset just because a new day
  // (or a 5am re-rank) rolled over.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const rawBatch = window.localStorage.getItem(BATCH_KEY);
      const rawSeen = window.localStorage.getItem(SEEN_KEY);
      setBatchIds(rawBatch ? (JSON.parse(rawBatch) as string[]) : null);
      setSeenIds(rawSeen ? (JSON.parse(rawSeen) as string[]) : []);
    } catch {
      setBatchIds(null);
      setSeenIds([]);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || batchIds === null) return;
    window.localStorage.setItem(BATCH_KEY, JSON.stringify(batchIds));
  }, [batchIds]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(seenIds));
  }, [seenIds]);

  const byId = useMemo(() => {
    const map = new Map<string, DigestPaper>();
    for (const paper of today.papers) {
      if (paper.itemId) map.set(paper.itemId, paper);
    }
    return map;
  }, [today.papers]);

  const visible = useMemo(
    () => (batchIds ?? []).map((id) => byId.get(id)).filter((p): p is DigestPaper => Boolean(p)),
    [batchIds, byId]
  );

  // Seed (or re-seed) the batch when there isn't a valid one: first load, or after
  // every shown paper dropped out (e.g. it got a note and moved to the Library).
  useEffect(() => {
    if (today.papers.length === 0) return;
    const needsSeed = batchIds === null || (batchIds.length > 0 && visible.length === 0);
    if (needsSeed) {
      setBatchIds(pickBatch(today.papers, seenIds, TODAY_PAGE));
    }
  }, [batchIds, visible.length, today.papers, seenIds]);

  const handleClear = useCallback(
    (id: string) => {
      void fetch("/api/digest/intake/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      }).then(loadIntake);
    },
    [loadIntake]
  );

  const handleClearDone = useCallback(() => {
    void fetch("/api/digest/intake/clear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }).then(loadIntake);
  }, [loadIntake]);

  const handleRetry = useCallback(
    (input: string) => {
      void fetch("/api/digest/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: [input] })
      }).then(loadIntake);
    },
    [loadIntake]
  );

  const handleUpload = useCallback(
    (file: File) => {
      const form = new FormData();
      form.append("file", file);
      void fetch("/api/digest/upload", { method: "POST", body: form }).then(loadIntake);
    },
    [loadIntake]
  );

  const handleGenerate = useCallback(
    (itemId: string, input: string) => {
      setGenerating((prev) => new Set(prev).add(itemId));
      void fetch("/api/digest/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, input })
      }).then(loadIntake);
    },
    [loadIntake]
  );

  // "cycle": mark the current batch seen and show the next unseen batch. When
  // everything has been cycled through, ask the recommender to refill and reset.
  const handleNext = useCallback(() => {
    const nowSeen = [...new Set([...seenIds, ...(batchIds ?? [])])];
    const next = pickBatch(today.papers, nowSeen, TODAY_PAGE);
    if (next.length === 0) {
      void fetch("/api/digest/refill", { method: "POST" }).catch(() => undefined);
      setSeenIds([]);
      setBatchIds(null); // re-seeds from the top once the refill lands
      return;
    }
    setSeenIds(nowSeen);
    setBatchIds(next);
  }, [seenIds, batchIds, today.papers]);

  // Library caret controls: optimistically recolor the row, then persist to the
  // note's frontmatter (+ registry) and refresh.
  const handleSetNotePriority = useCallback(
    (fileName: string, priority: Priority) => {
      setRecent((prev) => prev.map((note) => (note.fileName === fileName ? { ...note, priority } : note)));
      void fetch("/api/digest/note-priority", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName, priority })
      })
        .then(refresh)
        .catch(() => undefined);
    },
    [refresh]
  );

  const handleFeedback = useCallback((itemId: string, vote: Vote) => {
    let sent: Vote | "clear" = vote;
    setVotes((prev) => {
      const next = { ...prev };
      if (next[itemId] === vote) {
        delete next[itemId];
        sent = "clear";
      } else {
        next[itemId] = vote;
      }
      return next;
    });
    void fetch("/api/digest/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, vote: sent })
    }).catch(() => undefined);
  }, []);

  return (
    <div className="flex w-full flex-col gap-12">
      <DigestSubmitBar onSubmitted={refresh} />
      {error ? <p className="text-xs font-light text-red-400">{error}</p> : null}
      <DigestIntakeSection
        items={intake}
        vaultName={VAULT_NAME}
        onClear={handleClear}
        onClearDone={handleClearDone}
        onRetry={handleRetry}
        onUpload={handleUpload}
      />
      <DigestTodaySection
        date={today.date}
        papers={visible}
        total={today.papers.length}
        vaultName={VAULT_NAME}
        onNext={handleNext}
        onFeedback={handleFeedback}
        onGenerate={handleGenerate}
        generating={generating}
        votes={votes}
      />
      <DigestRecentSection notes={recent} vaultName={VAULT_NAME} onSetPriority={handleSetNotePriority} />
    </div>
  );
}

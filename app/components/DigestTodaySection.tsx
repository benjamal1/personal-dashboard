import { ThumbsUp, ThumbsDown, ArrowRight, FileText } from "lucide-react";

import type { DigestPaper } from "@/lib/digest";

type Vote = "up" | "down";

type DigestTodaySectionProps = {
  date: string | null;
  papers: DigestPaper[];
  total: number;
  vaultName: string;
  onNext: () => void;
  onFeedback: (itemId: string, vote: Vote) => void;
  onGenerate: (itemId: string, input: string) => void;
  generating: Set<string>;
  votes: Record<string, Vote>;
};

const VAULT_NOTES_PATH = "Articles and Papers/Reading Digest/Notes";

function sanitizeNoteSegment(value: string): string {
  return value
    .split("/")
    .filter((segment) => segment !== "" && segment !== "..")
    .join("/");
}

function obsidianLink(vaultName: string, noteFile: string): string {
  const filePath = `${VAULT_NOTES_PATH}/${sanitizeNoteSegment(noteFile)}`;
  return `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(filePath)}`;
}

export default function DigestTodaySection({
  date,
  papers,
  total,
  vaultName,
  onNext,
  onFeedback,
  onGenerate,
  generating,
  votes
}: DigestTodaySectionProps) {
  return (
    <section className="flex w-full flex-col gap-6">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-xs font-light uppercase tracking-[0.2em] text-zinc-700">
          {date ? `Today — ${date}` : "Today"}
          {total > 0 ? <span className="text-zinc-800"> · {total} queued</span> : null}
        </p>
        {total > papers.length ? (
          <button
            type="button"
            onClick={onNext}
            className="flex shrink-0 items-center gap-1 text-xs font-light text-zinc-500 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-600"
          >
            next <ArrowRight className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {papers.length === 0 ? (
        <p className="text-sm font-light text-zinc-600">
          No papers queued — the recommender runs at 5am
        </p>
      ) : (
        <ul className="flex flex-col gap-5">
          {papers.map((paper) => {
            const vote = paper.itemId ? votes[paper.itemId] : undefined;
            return (
              <li key={paper.itemId ?? paper.title} className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  {paper.noteFile ? (
                    <a
                      href={obsidianLink(vaultName, paper.noteFile)}
                      className="block text-sm font-light text-zinc-100 hover:text-zinc-300"
                    >
                      {paper.title}
                    </a>
                  ) : paper.sourceUrl ? (
                    <a
                      href={paper.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-sm font-light text-zinc-100 hover:text-zinc-300"
                    >
                      {paper.title}
                    </a>
                  ) : (
                    <p className="text-sm font-light text-zinc-100">{paper.title}</p>
                  )}
                  <p className="mt-1 text-xs font-light text-zinc-600">
                    {paper.authors ? `${paper.authors} · ` : ""}
                    {paper.added}
                    {paper.topics.length > 0 ? ` · ${paper.topics.join(", ")}` : ""}
                  </p>
                </div>
                {paper.itemId ? (
                  <div className="flex shrink-0 items-center gap-2">
                    {!paper.noteFile ? (
                      generating.has(paper.itemId) ? (
                        <span className="text-xs font-light text-zinc-600">summarizing…</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onGenerate(paper.itemId!, paper.sourceUrl ?? paper.title)}
                          title="Generate summary note"
                          className="flex items-center gap-1 text-xs font-light text-zinc-500 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-600"
                        >
                          <FileText className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                          summarize
                        </button>
                      )
                    ) : null}
                    <button
                      type="button"
                      aria-label="More like this"
                      aria-pressed={vote === "up"}
                      onClick={() => onFeedback(paper.itemId!, "up")}
                      className={`focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-600 ${
                        vote === "up" ? "text-zinc-200" : "text-zinc-700 hover:text-zinc-400"
                      }`}
                    >
                      <ThumbsUp className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label="Less like this"
                      aria-pressed={vote === "down"}
                      onClick={() => onFeedback(paper.itemId!, "down")}
                      className={`focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-600 ${
                        vote === "down" ? "text-zinc-200" : "text-zinc-700 hover:text-zinc-400"
                      }`}
                    >
                      <ThumbsDown className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

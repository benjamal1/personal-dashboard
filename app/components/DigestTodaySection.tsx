import type { DigestPaper } from "@/lib/digest";

type DigestTodaySectionProps = {
  date: string | null;
  papers: DigestPaper[];
  vaultName: string;
};

const VAULT_NOTES_PATH = "Articles and Papers/Reading Digest/Notes";

function sanitizeNoteSegment(value: string): string {
  return value
    .split("/")
    .filter((segment) => segment !== "" && segment !== "..")
    .join("/");
}

function obsidianLink(vaultName: string, noteFile: string): string {
  const filePath = `${VAULT_NOTES_PATH}/${sanitizeNoteSegment(noteFile)}.md`;
  return `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(filePath)}`;
}

type FeedbackBadgeProps = { feedback: string | null };

function FeedbackBadge({ feedback }: FeedbackBadgeProps): JSX.Element | null {
  if (feedback === "more") {
    return <span className="text-xs font-light text-zinc-400">more ↑</span>;
  }

  if (feedback === "less") {
    return <span className="text-xs font-light text-zinc-400">less ↓</span>;
  }

  return null;
}

export default function DigestTodaySection({ date, papers, vaultName }: DigestTodaySectionProps) {
  return (
    <section className="flex w-full flex-col gap-6">
      <p className="text-xs font-light uppercase tracking-[0.2em] text-zinc-700">
        {date ? `Today — ${date} · assigned by recommender` : "Today"}
      </p>

      {papers.length === 0 ? (
        <p className="text-sm font-light text-zinc-600">
          No papers assigned today — daily recommender runs at 5am
        </p>
      ) : (
        <ul className="flex flex-col gap-5">
          {papers.map((paper) => (
            <li key={paper.title} className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                {paper.noteFile ? (
                  <a
                    href={obsidianLink(vaultName, paper.noteFile)}
                    className="block text-sm font-light text-zinc-100 hover:text-zinc-300"
                  >
                    {paper.title}
                  </a>
                ) : (
                  <p className="text-sm font-light text-zinc-100">{paper.title}</p>
                )}
                <p className="mt-1 text-xs font-light text-zinc-600">
                  {paper.authors} · {paper.added}
                  {paper.topics.length > 0 ? ` · ${paper.topics.join(", ")}` : ""}
                </p>
                {paper.tags.length > 0 ? (
                  <p className="mt-1 text-xs font-light text-zinc-700">{paper.tags.join(", ")}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {paper.status ? (
                  <span className="text-xs font-light text-zinc-500">{paper.status}</span>
                ) : null}
                <FeedbackBadge feedback={paper.feedback} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

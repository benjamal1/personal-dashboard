"use client";

import { useMemo, useState } from "react";
import {
  BookOpenText,
  CheckSquare,
  GraduationCap,
  type LucideIcon,
  Mail,
  RadioTower
} from "lucide-react";

import Clock from "./Clock";
import TodoList from "./TodoList";
import Weather from "./Weather";
import ClaudexUsage from "./ClaudexUsage";

type ViewId = "home" | "tasks" | "usage" | "digest";

type QuickLink = {
  label: string;
  href: string;
  icon: LucideIcon | typeof GitHubLogo;
};

type NavItem = {
  id: Exclude<ViewId, "home">;
  label: string;
  kicker: string;
  icon: LucideIcon;
};

const QUICK_LINKS: QuickLink[] = [
  {
    label: "Gmail 1",
    href: "https://mail.google.com/mail/u/0/",
    icon: Mail
  },
  {
    label: "Gmail 2",
    href: "https://mail.google.com/mail/u/1/",
    icon: Mail
  },
  {
    label: "GitHub",
    href: "https://github.com",
    icon: GitHubLogo
  },
  {
    label: "Canvas",
    href: "https://canvas.brown.edu",
    icon: GraduationCap
  },
  {
    label: "YouTube",
    href: "https://www.youtube.com",
    icon: YouTubeLogo
  }
];

const NAV_ITEMS: NavItem[] = [
  {
    id: "tasks",
    label: "Task tracker",
    kicker: "weekly work",
    icon: CheckSquare
  },
  {
    id: "usage",
    label: "Claudex usage",
    kicker: "limits and pace",
    icon: RadioTower
  },
  {
    id: "digest",
    label: "Reading digest",
    kicker: "papers and notes",
    icon: BookOpenText
  }
];

type DashboardShellProps = {
  initialTimestamp: string;
};

export default function DashboardShell({ initialTimestamp }: DashboardShellProps) {
  const [activeView, setActiveView] = useState<ViewId>("home");
  const [previewView, setPreviewView] = useState<ViewId | null>(null);

  const visibleView = previewView ?? activeView;
  const activeItem = useMemo(
    () => NAV_ITEMS.find((item) => item.id === visibleView),
    [visibleView]
  );

  return (
    <main className="min-h-dvh bg-[#111111] text-zinc-100">
      <aside
        className="fixed inset-x-0 top-0 z-20 border-b border-zinc-900/90 bg-[#111111]/95 px-4 py-3 backdrop-blur md:inset-x-auto md:bottom-0 md:left-0 md:w-64 md:border-b-0 md:border-r md:px-6 md:py-8"
        aria-label="Dashboard navigation"
        onMouseLeave={() => setPreviewView(null)}
      >
        <nav className="flex items-center gap-4 md:h-full md:flex-col md:items-stretch md:gap-10">
          <section className="flex min-w-0 items-center gap-2 md:flex-col md:items-stretch" aria-label="Quick links">
            <p className="hidden text-xs uppercase tracking-[0.2em] text-zinc-700 md:block">quicklinks</p>
            <div className="flex items-center gap-1 md:mt-2 md:gap-2">
              {QUICK_LINKS.map((link) => {
                const LinkIcon = link.icon;

                return (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-11 w-11 items-center justify-center text-zinc-600 transition-colors duration-200 hover:text-zinc-200 focus-visible:text-zinc-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-600"
                    aria-label={link.label}
                    title={link.label}
                  >
                    <LinkIcon className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                  </a>
                );
              })}
            </div>
          </section>

          <section className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto md:flex-col md:items-stretch md:overflow-visible" aria-label="Sections">
            {NAV_ITEMS.map((item) => {
              const ItemIcon = item.icon;
              const isSelected = activeView === item.id;
              const isVisible = visibleView === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveView(item.id);
                    setPreviewView(null);
                  }}
                  onMouseEnter={() => setPreviewView(item.id)}
                  onFocus={() => setPreviewView(item.id)}
                  onBlur={() => setPreviewView(null)}
                  aria-current={isSelected ? "page" : undefined}
                  className={`group flex h-11 shrink-0 items-center gap-3 px-3 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-600 md:h-auto md:w-full md:px-0 md:py-3 ${
                    isVisible ? "text-zinc-100" : "text-zinc-600 hover:text-zinc-300"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center transition-colors duration-200 ${
                      isVisible ? "text-zinc-200" : "text-zinc-700 group-hover:text-zinc-500"
                    }`}
                    aria-hidden="true"
                  >
                    <ItemIcon className="h-4 w-4" strokeWidth={1.5} />
                  </span>
                  <span className="hidden min-w-0 md:block">
                    <span className="block text-sm font-light">{item.label}</span>
                    <span className="mt-1 block text-xs font-light text-zinc-700">{item.kicker}</span>
                  </span>
                </button>
              );
            })}
          </section>
        </nav>
      </aside>

      <button
        type="button"
        onClick={() => {
          setActiveView("home");
          setPreviewView(null);
        }}
        className="fixed right-5 top-4 z-30 flex h-11 w-11 items-center justify-center border border-zinc-800 text-sm font-normal tracking-[0.18em] text-zinc-300 transition-colors duration-200 hover:border-zinc-700 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-600 md:right-8 md:top-8"
        aria-label="Return home"
        title="Home"
      >
        BJ
      </button>

      <section className="flex min-h-dvh items-center justify-center px-6 pb-16 pt-28 md:pl-72 md:pr-10 md:pt-16">
        {visibleView === "home" ? (
          <div className="flex w-full max-w-lg flex-col items-center gap-0 px-2 md:px-8">
            <>
              <Clock initialTimestamp={initialTimestamp} />
              <Weather />
              <TodoList />
            </>
          </div>
        ) : visibleView === "usage" ? (
          <div className="flex w-full flex-col items-center px-0 md:px-4">
            <ClaudexUsage />
          </div>
        ) : (
          <div className="flex w-full max-w-lg flex-col items-center gap-0 px-2 md:px-8">
            <PlaceholderView
              title={activeItem?.label ?? "Dashboard"}
              kicker={activeItem?.kicker ?? "placeholder"}
              locked={activeView === visibleView}
            />
          </div>
        )}
      </section>
    </main>
  );
}

function GitHubLogo({
  className,
  "aria-hidden": ariaHidden
}: {
  className?: string;
  strokeWidth?: number;
  "aria-hidden"?: boolean | "true" | "false";
}) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden={ariaHidden}>
      <path d="M12 2C6.48 2 2 6.58 2 12.26c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.5 0-.24-.01-1.05-.01-1.9-2.78.62-3.37-1.22-3.37-1.22-.45-1.2-1.11-1.52-1.11-1.52-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.35 1.12 2.92.85.09-.66.35-1.12.63-1.38-2.22-.26-4.55-1.14-4.55-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.31.1-2.72 0 0 .84-.28 2.75 1.05A9.32 9.32 0 0 1 12 6.92c.85 0 1.7.12 2.5.34 1.9-1.33 2.74-1.05 2.74-1.05.55 1.41.2 2.46.1 2.72.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9 0 1.38-.01 2.49-.01 2.83 0 .28.18.6.69.5A10.08 10.08 0 0 0 22 12.26C22 6.58 17.52 2 12 2Z" />
    </svg>
  );
}

function YouTubeLogo({
  className,
  "aria-hidden": ariaHidden
}: {
  className?: string;
  strokeWidth?: number;
  "aria-hidden"?: boolean | "true" | "false";
}) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden={ariaHidden}>
      <path d="M21.58 7.19a2.5 2.5 0 0 0-1.76-1.77C18.26 5 12 5 12 5s-6.26 0-7.82.42a2.5 2.5 0 0 0-1.76 1.77A26.07 26.07 0 0 0 2 12a26.07 26.07 0 0 0 .42 4.81 2.5 2.5 0 0 0 1.76 1.77C5.74 19 12 19 12 19s6.26 0 7.82-.42a2.5 2.5 0 0 0 1.76-1.77A26.07 26.07 0 0 0 22 12a26.07 26.07 0 0 0-.42-4.81ZM10 15V9l5.2 3L10 15Z" />
    </svg>
  );
}

function PlaceholderView({
  title,
  kicker,
  locked
}: {
  title: string;
  kicker: string;
  locked: boolean;
}) {
  return (
    <section className="flex min-h-[340px] w-full flex-col items-center justify-center text-center">
      <p className="text-xs font-light uppercase tracking-[0.2em] text-zinc-700">{kicker}</p>
      <h1 className="mt-4 text-4xl font-light text-zinc-100 sm:text-5xl">{title}</h1>
      <p className="mt-5 max-w-xs text-sm font-light leading-6 text-zinc-600">
        {locked ? "Selected page placeholder." : "Hover preview placeholder."}
      </p>
    </section>
  );
}

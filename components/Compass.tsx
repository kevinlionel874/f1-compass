"use client";

import { Fragment, useState, type FormEvent, type ReactNode } from "react";
import ThemePicker from "@/components/ThemePicker";
import type { Assessment, Plan, Source, Step, StreamEvent, Verdict } from "@/lib/types";

const EXAMPLES = [
  "Freelance web development for a client in China while I'm studying in Illinois",
  "Sell AI-generated coloring books on Amazon KDP",
  "Accept prize money from an online hackathon",
  "Work 25 hours a week as a paid TA during the semester",
  "Do a remote summer internship for a U.S. startup",
];

const STEPS: { id: Step; label: string }[] = [
  { id: "plan", label: "Understanding your situation" },
  { id: "search", label: "Searching official sources" },
  { id: "analyze", label: "Checking the rules" },
];

// Verdict colors are semantic and stay the same in every accent theme.
const VERDICT_STYLE: Record<
  Verdict,
  { label: string; tone: string; wash: string; icon: "check" | "key" | "x" | "question" }
> = {
  likely_allowed: {
    label: "Likely allowed",
    tone: "bg-emerald-500/10 text-emerald-700 ring-emerald-600/20 dark:text-emerald-300 dark:ring-emerald-400/25",
    wash: "from-emerald-500/10",
    icon: "check",
  },
  needs_authorization: {
    label: "Needs authorization first",
    tone: "bg-amber-500/10 text-amber-700 ring-amber-600/25 dark:text-amber-300 dark:ring-amber-400/25",
    wash: "from-amber-500/10",
    icon: "key",
  },
  likely_not_allowed: {
    label: "Likely not allowed",
    tone: "bg-rose-500/10 text-rose-700 ring-rose-600/20 dark:text-rose-300 dark:ring-rose-400/25",
    wash: "from-rose-500/10",
    icon: "x",
  },
  unclear: {
    label: "Unclear: ask your DSO",
    tone: "bg-zinc-500/10 text-zinc-700 ring-zinc-500/25 dark:text-zinc-300 dark:ring-zinc-400/25",
    wash: "from-zinc-500/10",
    icon: "question",
  },
};

const CARD = "rounded-2xl border border-line bg-surface p-5";

interface Result {
  assessment: Assessment;
  models: { fast: string; reasoning: string };
  mock: boolean;
}

export default function Compass() {
  const [question, setQuestion] = useState("");
  const [schoolDomain, setSchoolDomain] = useState("");
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState<Step | null>(null);
  const [stepDetail, setStepDetail] = useState<Partial<Record<Step, string>>>({});
  const [plan, setPlan] = useState<Plan | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function check(e?: FormEvent) {
    e?.preventDefault();
    const q = question.trim();
    if (!q || running) return;

    setRunning(true);
    setStep(null);
    setStepDetail({});
    setPlan(null);
    setSources([]);
    setResult(null);
    setError(null);

    let finished = false;
    const handle = (event: StreamEvent) => {
      switch (event.type) {
        case "status":
          setStep(event.step);
          setStepDetail((d) => ({ ...d, [event.step]: event.message }));
          break;
        case "plan":
          setPlan(event.plan);
          break;
        case "sources":
          setSources(event.sources);
          break;
        case "result":
          finished = true;
          setResult({ assessment: event.assessment, models: event.models, mock: event.mock });
          break;
        case "error":
          finished = true;
          setError(event.message);
          break;
      }
    };

    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, schoolDomain }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `Request failed (${res.status}).`);
      }

      // The server streams one JSON event per line.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) if (line.trim()) handle(JSON.parse(line));
      }
      if (buffer.trim()) handle(JSON.parse(buffer));
      if (!finished) throw new Error("The connection closed before an answer arrived. Please try again.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setRunning(false);
      setStep(null);
    }
  }

  const showProgress = running || plan !== null || result !== null;

  return (
    <div className="relative isolate flex flex-1 flex-col overflow-x-clip bg-bg text-fg">
      <Backdrop />

      <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 pt-5">
        <div className="flex items-center gap-2.5">
          <Logo />
          <span className="text-[17px] font-semibold tracking-tight">F1 Compass</span>
        </div>
        <ThemePicker />
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-20">
        <section className="pt-12 sm:pt-20">
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 px-3 py-1 text-xs font-medium text-muted backdrop-blur">
            <span className="size-1.5 rounded-full bg-accent" />
            For F-1 international students
          </p>
          <h1 className="mt-5 font-display text-[46px] leading-[1.02] tracking-tight text-balance sm:text-[68px]">
            Know <em className="text-accent">before</em> you work.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted sm:text-lg sm:leading-8">
            Describe what you want to do. F1 Compass reads official U.S. government sources and
            tells you whether F-1 rules likely allow it, with citations and an email for your
            school&apos;s international office.
          </p>
        </section>

        <form
          onSubmit={check}
          className="mt-9 rounded-3xl border border-line bg-surface/80 p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_30px_60px_-30px_var(--glow)] backdrop-blur-xl sm:p-6"
        >
          <label htmlFor="question" className="text-sm font-medium">
            What do you want to do?
          </label>
          <textarea
            id="question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) check();
            }}
            rows={3}
            maxLength={2000}
            placeholder="e.g. Build a website for a small business back home and get paid while I'm on campus"
            className="mt-2 w-full resize-y rounded-2xl border border-line bg-surface-2 px-4 py-3.5 text-base leading-6 text-fg outline-none transition placeholder:text-muted/70 focus:border-accent focus:bg-surface focus:ring-4 focus:ring-accent/15"
          />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[11px] font-semibold tracking-widest text-muted uppercase">Try</span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setQuestion(ex)}
                className="rounded-full border border-line bg-surface px-3 py-1.5 text-left text-sm text-muted transition-colors hover:border-accent/40 hover:bg-accent-soft hover:text-fg"
              >
                {ex}
              </button>
            ))}
          </div>

          <div className="mt-5 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor="school" className="text-sm font-medium">
                Your school&apos;s international office site{" "}
                <span className="font-normal text-muted">(optional)</span>
              </label>
              <div className="relative mt-1.5">
                <GlobeIcon />
                <input
                  id="school"
                  value={schoolDomain}
                  onChange={(e) => setSchoolDomain(e.target.value)}
                  placeholder="isss.illinois.edu"
                  className="h-12 w-full rounded-2xl border border-line bg-surface-2 pr-4 pl-10 text-base text-fg outline-none transition placeholder:text-muted/70 focus:border-accent focus:bg-surface focus:ring-4 focus:ring-accent/15"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={running || !question.trim()}
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-accent px-6 font-medium text-accent-contrast shadow-[0_10px_28px_-10px_var(--glow),inset_0_1px_0_rgb(255_255_255/0.18)] transition hover:bg-accent-strong active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
            >
              {running ? (
                <>
                  <Spinner /> Checking…
                </>
              ) : (
                <>
                  Check it
                  <ArrowIcon />
                </>
              )}
            </button>
          </div>
        </form>

        {showProgress && (
          <Progress step={step} detail={stepDetail} done={result !== null} failed={error !== null} />
        )}

        {error && (
          <div
            role="alert"
            className="mt-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300"
          >
            {error}
          </div>
        )}

        {result && <ResultView result={result} sources={sources} />}

        {!result && sources.length > 0 && <SourceList sources={sources} />}
      </main>

      <footer className="border-t border-line px-4 py-8">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 text-xs leading-5 text-muted sm:flex-row sm:items-start sm:justify-between sm:gap-8">
          <p className="max-w-md">
            F1 Compass gives general information, not legal advice. Immigration rules depend on your
            exact facts. Always confirm with your school&apos;s Designated School Official (DSO)
            before acting.
          </p>
          <p className="shrink-0 sm:text-right">
            Powered by NVIDIA Nemotron
            <br className="hidden sm:block" /> on Nebius Token Factory · Search by Tavily
          </p>
        </div>
      </footer>
    </div>
  );
}

function Progress({
  step,
  detail,
  done,
  failed,
}: {
  step: Step | null;
  detail: Partial<Record<Step, string>>;
  done: boolean;
  failed: boolean;
}) {
  const current = step ? STEPS.findIndex((s) => s.id === step) : -1;
  return (
    <ol className="mt-6 grid gap-1 rounded-2xl border border-line bg-surface/80 p-1.5 backdrop-blur sm:grid-cols-3">
      {STEPS.map((s, i) => {
        const state = done || i < current ? "done" : i === current && !failed ? "active" : "pending";
        return (
          <li
            key={s.id}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${state === "active" ? "bg-accent-soft" : ""}`}
          >
            <span
              className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                state === "done"
                  ? "bg-accent text-accent-contrast"
                  : state === "active"
                    ? "text-accent"
                    : "border border-line text-muted"
              }`}
            >
              {state === "done" ? (
                <CheckIcon className="size-3.5" />
              ) : state === "active" ? (
                <Spinner className="size-5" />
              ) : (
                i + 1
              )}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">{s.label}</span>
              {detail[s.id] && (
                <span className="block truncate font-mono text-[11px] text-muted">{detail[s.id]}</span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function ResultView({ result, sources }: { result: Result; sources: Source[] }) {
  const { assessment: a } = result;
  const verdict = VERDICT_STYLE[a.verdict];
  const ids = new Set(sources.map((s) => s.id));

  return (
    <section className="mt-6 space-y-4">
      {result.mock && (
        <p className="rounded-2xl border border-dashed border-amber-500/50 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-800 dark:text-amber-300">
          Mock mode: this is sample data, not a real analysis. Set MOCK_MODE=0 and add API keys to
          run real checks.
        </p>
      )}

      <div className="relative overflow-hidden rounded-3xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_30px_60px_-34px_var(--glow)] sm:p-7">
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-x-0 top-0 h-40 bg-linear-to-b ${verdict.wash} to-transparent`}
        />
        <div className="relative">
          <div className="flex items-center gap-3">
            <span
              className={`flex size-10 items-center justify-center rounded-full ring-1 ring-inset ${verdict.tone}`}
            >
              <VerdictIcon name={verdict.icon} />
            </span>
            <span className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset ${verdict.tone}`}>
              {verdict.label}
            </span>
          </div>
          <h2 className="mt-4 text-xl leading-snug font-semibold tracking-tight text-balance sm:text-2xl">
            {a.headline}
          </h2>
          <div className="mt-4 space-y-3 text-[15px] leading-7 text-fg/85">
            {a.explanation
              .split(/\n\s*\n/)
              .filter((p) => p.trim())
              .map((p, i) => (
                <p key={i}>{withCitations(p, ids)}</p>
              ))}
          </div>

          {a.authorizationPaths.length > 0 && (
            <div className="mt-6 border-t border-line pt-5">
              <h3 className="text-[11px] font-semibold tracking-widest text-muted uppercase">
                Ways to do this legally
              </h3>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {a.authorizationPaths.map((p) => (
                  <span key={p} className="rounded-xl bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="What decides the answer" items={a.keyFactors} />
        <Card title="Ask your DSO" items={a.questionsForDso} />
      </div>

      {a.dsoEmail && <EmailDraft text={a.dsoEmail} />}

      {a.assumptions.length > 0 && (
        <div className={CARD}>
          <h3 className="text-sm font-semibold">We assumed</h3>
          <BulletList items={a.assumptions} muted />
          <p className="mt-3 text-sm text-muted">
            If any of these are wrong, add the detail to your question and check again.
          </p>
        </div>
      )}

      <SourceList sources={sources} />
    </section>
  );
}

function Card({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className={CARD}>
      <h3 className="text-sm font-semibold">{title}</h3>
      <BulletList items={items} />
    </div>
  );
}

function BulletList({ items, muted = false }: { items: string[]; muted?: boolean }) {
  return (
    <ul className={`mt-3 space-y-2 text-sm leading-6 ${muted ? "text-muted" : "text-fg/85"}`}>
      {items.map((x) => (
        <li key={x} className="flex gap-2.5">
          <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
          <span className="min-w-0">{x}</span>
        </li>
      ))}
    </ul>
  );
}

function EmailDraft({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={CARD}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Email to your DSO</h3>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 text-sm font-medium transition-colors hover:border-accent/40 hover:bg-accent-soft"
        >
          {copied ? <CheckIcon className="size-3.5 text-accent" /> : <CopyIcon />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="mt-3 rounded-xl border border-line bg-surface-2 p-4 font-sans text-sm leading-6 whitespace-pre-wrap text-fg/85">
        {text}
      </pre>
    </div>
  );
}

function SourceList({ sources }: { sources: Source[] }) {
  if (!sources.length) return null;
  return (
    <div className={`mt-4 ${CARD}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold">Official sources</h3>
        <span className="text-xs text-muted">{sources.length} pages</span>
      </div>
      <ol className="mt-3 space-y-1">
        {sources.map((s) => (
          <li
            key={s.id}
            id={`source-${s.id}`}
            className="-mx-2 flex scroll-mt-6 gap-3 rounded-xl p-2 transition-colors target:bg-accent-soft hover:bg-surface-2"
          >
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg bg-accent-soft font-mono text-xs font-semibold text-accent">
              {s.id}
            </span>
            <div className="min-w-0">
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-fg decoration-accent/40 underline-offset-4 hover:underline"
              >
                {s.title}
              </a>
              <p className="truncate text-xs text-accent">{hostname(s.url)}</p>
              <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted">{s.snippet}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Turns "[1]" or "[1, 2]" in model text into links to the numbered sources. */
function withCitations(text: string, ids: Set<number>): ReactNode[] {
  return text.split(/(\[\d+(?:\s*,\s*\d+)*\])/g).map((part, i) => {
    const nums = /^\[[\d,\s]+\]$/.test(part) ? part.slice(1, -1).split(",").map((n) => Number(n.trim())) : null;
    if (!nums || !nums.every((n) => ids.has(n))) return <Fragment key={i}>{part}</Fragment>;
    return (
      <Fragment key={i}>
        {nums.map((n) => (
          <a
            key={n}
            href={`#source-${n}`}
            className="mx-0.5 inline-flex min-w-5 items-center justify-center rounded-md bg-accent-soft px-1 align-[0.1em] font-mono text-[0.72em] font-semibold text-accent no-underline transition-colors hover:bg-accent hover:text-accent-contrast"
          >
            {n}
          </a>
        ))}
      </Fragment>
    );
  });
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Soft accent glow, a faint grid and a compass rose behind the hero. Purely decorative. */
function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[680px] overflow-hidden">
      <div className="absolute top-[-280px] left-1/2 h-[560px] w-[min(1000px,150vw)] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--glow),transparent)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--line)_1px,transparent_1px),linear-gradient(to_bottom,var(--line)_1px,transparent_1px)] [background-size:44px_44px] opacity-60 [mask-image:radial-gradient(ellipse_70%_55%_at_50%_0%,black,transparent)]" />
      <CompassRose className="absolute -top-52 -right-64 size-[560px] text-accent opacity-[0.16] sm:-top-40 sm:-right-40 dark:opacity-25" />
    </div>
  );
}

function CompassRose({ className }: { className?: string }) {
  const ticks = Array.from({ length: 72 }, (_, i) => i * 5);
  return (
    <svg viewBox="-300 -300 600 600" className={className} fill="none" stroke="currentColor">
      <circle r="290" strokeWidth="1" />
      <circle r="232" strokeWidth="1" />
      <circle r="150" strokeWidth="0.75" strokeDasharray="2 6" />
      {ticks.map((deg) => (
        <line
          key={deg}
          x1="0"
          y1="-290"
          x2="0"
          y2={deg % 45 === 0 ? -256 : -276}
          strokeWidth={deg % 45 === 0 ? 2 : 1}
          transform={`rotate(${deg})`}
        />
      ))}
      <path
        d="M0 -212 L24 -24 L212 0 L24 24 L0 212 L-24 24 L-212 0 L-24 -24 Z"
        fill="currentColor"
        fillOpacity="0.08"
        strokeWidth="1"
      />
      <path
        d="M0 -132 L15 -15 L132 0 L15 15 L0 132 L-15 15 L-132 0 L-15 -15 Z"
        transform="rotate(45)"
        fill="currentColor"
        fillOpacity="0.06"
        strokeWidth="0.75"
      />
    </svg>
  );
}

function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="size-8 drop-shadow-sm" aria-hidden>
      <rect width="32" height="32" rx="9" className="fill-accent" />
      <circle cx="16" cy="16" r="9" fill="none" className="stroke-accent-contrast" strokeWidth="1.6" opacity="0.85" />
      <path d="M19.5 12.5 17.2 17.2 12.5 19.5 14.8 14.8Z" className="fill-accent-contrast" />
    </svg>
  );
}

const ICON = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function VerdictIcon({ name }: { name: "check" | "key" | "x" | "question" }) {
  if (name === "check") return <CheckIcon className="size-5" />;
  if (name === "x")
    return (
      <svg {...ICON} className="size-5">
        <path d="M6 6l12 12M18 6 6 18" />
      </svg>
    );
  if (name === "key")
    return (
      <svg {...ICON} className="size-5">
        <circle cx="8" cy="15" r="4" />
        <path d="m10.8 12.2 8.7-8.7M17 6l2 2M14.5 8.5l2 2" />
      </svg>
    );
  return (
    <svg {...ICON} className="size-5">
      <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4.5" />
      <path d="M12 18h.01" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg {...ICON} strokeWidth={2.5} className={className}>
      <path d="M5 12.5 10 17 19 7" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg {...ICON} className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg {...ICON} strokeWidth={1.8} className="size-3.5">
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg
      {...ICON}
      strokeWidth={1.6}
      className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  );
}

function Spinner({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`motion-safe:animate-spin ${className}`} aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

"use client";

import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { flushSync } from "react-dom";
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

type IconName = "check" | "key" | "x" | "question";

// Verdict colors are semantic (the --v-* tokens in globals.css) and stay the same in every accent theme.
const VERDICT: Record<
  Verdict,
  { big: string; why: string; stamp: string; color: string; icon: IconName }
> = {
  likely_allowed: {
    big: "Likely allowed",
    why: "Why it's likely allowed",
    stamp: "LIKELY OK",
    color: "var(--v-allowed)",
    icon: "check",
  },
  needs_authorization: {
    big: "Authorization needed",
    why: "Why you need authorization first",
    stamp: "AUTH FIRST",
    color: "var(--v-auth)",
    icon: "key",
  },
  likely_not_allowed: {
    big: "Likely not allowed",
    why: "Why it's likely not allowed",
    stamp: "NOT ALLOWED",
    color: "var(--v-no)",
    icon: "x",
  },
  unclear: {
    big: "Unclear",
    why: "Why we can't say for sure",
    stamp: "ASK YOUR DSO",
    color: "var(--v-unclear)",
    icon: "question",
  },
};

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
  const [asked, setAsked] = useState("");
  const [whyOpen, setWhyOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const verdictRef = useRef<HTMLHeadingElement>(null);

  // A verdict recolors the whole page (backdrop, glow, visa stamp) through <html data-verdict>.
  useEffect(() => {
    if (!result) return;
    const root = document.documentElement;
    root.dataset.verdict = result.assessment.verdict;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    verdictRef.current?.focus({ preventScroll: true });
    return () => {
      delete root.dataset.verdict;
    };
  }, [result]);

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
    setAsked(q);
    setWhyOpen(false);
    setSourcesOpen(false);

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

  function startOver(keepQuestion: boolean) {
    setResult(null);
    setPlan(null);
    setSources([]);
    setStepDetail({});
    setError(null);
    if (!keepQuestion) setQuestion("");
    requestAnimationFrame(() => document.getElementById("question")?.focus());
  }

  const showProgress = running || plan !== null;

  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 pt-5">
        <div className="flex items-center gap-2.5">
          <Logo />
          <span className="text-[18px] font-extrabold tracking-tight">F1 Compass</span>
        </div>
        <ThemePicker />
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-20">
        {result ? (
          <ResultScreen
            result={result}
            sources={sources}
            question={asked}
            verdictRef={verdictRef}
            whyOpen={whyOpen}
            onWhyToggle={setWhyOpen}
            sourcesOpen={sourcesOpen}
            onSourcesToggle={setSourcesOpen}
            onEdit={() => startOver(true)}
            onNew={() => startOver(false)}
          />
        ) : (
          <>
        <section className="pt-12 sm:pt-20">
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/70 px-3 py-1 text-xs font-semibold text-muted backdrop-blur">
            <span className="size-1.5 rounded-full bg-accent" />
            For F-1 international students
          </p>
          <h1 className="mt-5 font-display text-[clamp(44px,11.5vw,92px)] leading-[1] font-extrabold tracking-tight text-balance">
            Know{" "}
            <span className="relative inline-block text-[1.25em] leading-[0.9]">
              <em className="font-[1000] text-accent">before</em>
              <svg
                viewBox="0 0 200 20"
                preserveAspectRatio="none"
                aria-hidden
                className="absolute -bottom-[0.06em] left-0 h-[0.16em] w-full text-accent"
              >
                <path
                  d="M4 14 C 60 3, 140 3, 196 11"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="7"
                  strokeLinecap="round"
                />
              </svg>
            </span>{" "}
            you work.
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
          <label htmlFor="question" className="text-sm font-semibold">
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
            <span className="mr-1 text-[11px] font-bold tracking-widest text-muted uppercase">Try</span>
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
              <label htmlFor="school" className="text-sm font-semibold">
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
              className="group inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-accent px-6 font-bold text-accent-contrast shadow-[0_10px_28px_-10px_var(--glow),inset_0_1px_0_rgb(255_255_255/0.18)] transition hover:bg-accent-strong active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
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

        {running && sources.length > 0 && (
          <p className="mt-3 px-1 text-sm text-muted">
            Found {sources.length} official pages. Reading them now…
          </p>
        )}
          </>
        )}
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
              <span className="block text-sm font-semibold">{s.label}</span>
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

/**
 * After a check the page turns into the verdict: a big colored answer up top,
 * and the reasons in collapsible sections below.
 */
function ResultScreen({
  result,
  sources,
  question,
  verdictRef,
  whyOpen,
  onWhyToggle,
  sourcesOpen,
  onSourcesToggle,
  onEdit,
  onNew,
}: {
  result: Result;
  sources: Source[];
  question: string;
  verdictRef: RefObject<HTMLHeadingElement | null>;
  whyOpen: boolean;
  onWhyToggle: (open: boolean) => void;
  sourcesOpen: boolean;
  onSourcesToggle: (open: boolean) => void;
  onEdit: () => void;
  onNew: () => void;
}) {
  const { assessment: a } = result;
  const v = VERDICT[a.verdict];
  const ids = new Set(sources.map((s) => s.id));
  // Citations point into the collapsed sources section: open it synchronously so the #source-n jump lands.
  const openSources = () => flushSync(() => onSourcesToggle(true));

  return (
    <section className="pt-8 sm:pt-12" style={{ "--verdict": v.color } as CSSProperties}>
      <div className="rise-in flex flex-col gap-3 rounded-2xl border border-line bg-surface/80 px-4 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="min-w-0 text-sm leading-6 text-muted">
          <span className="font-bold text-fg">You asked: </span>
          {question}
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-xl border border-line px-3 py-1.5 text-sm font-semibold transition-colors hover:border-accent/40 hover:bg-accent-soft"
          >
            Edit question
          </button>
          <button
            type="button"
            onClick={onNew}
            className="rounded-xl bg-accent px-3 py-1.5 text-sm font-bold text-accent-contrast transition hover:bg-accent-strong"
          >
            New check
          </button>
        </div>
      </div>

      {result.mock && (
        <p className="mt-4 rounded-2xl border border-dashed border-amber-500/50 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-800 dark:text-amber-300">
          Mock mode: this is sample data, not a real analysis. Set MOCK_MODE=0 and add API keys to
          run real checks.
        </p>
      )}

      <div className="relative mt-6 overflow-hidden rounded-[2rem] border border-[color:color-mix(in_oklab,var(--verdict)_35%,transparent)] bg-surface/85 px-6 py-12 text-center shadow-[0_40px_80px_-40px_color-mix(in_oklab,var(--verdict)_55%,transparent)] backdrop-blur-xl sm:py-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_70%_at_50%_0%,color-mix(in_oklab,var(--verdict)_22%,transparent),transparent_70%)]"
        />
        <VerdictStamp
          word={v.stamp}
          className="verdict-stamp pointer-events-none absolute -top-3 -right-5 size-[118px] -rotate-12 text-(--verdict) sm:top-4 sm:right-6 sm:size-[150px]"
        />
        <div className="relative">
          <div className="relative mx-auto size-24">
            <span aria-hidden className="verdict-ring absolute inset-0 rounded-full bg-(--verdict) opacity-0" />
            <span className="verdict-pop relative flex size-24 items-center justify-center rounded-full bg-(--verdict) text-(--bg) shadow-[0_16px_40px_-12px_var(--verdict)]">
              <VerdictIcon name={v.icon} className="size-12" />
            </span>
          </div>
          <p className="rise-in mt-6 text-[11px] font-bold tracking-[0.2em] text-muted uppercase">
            F1 Compass verdict
          </p>
          <h2
            ref={verdictRef}
            tabIndex={-1}
            className="rise-in mt-2 text-[clamp(40px,9vw,72px)] leading-[1.02] font-[1000] tracking-tight text-balance text-(--verdict) outline-none"
          >
            {v.big}
          </h2>
          <p className="rise-in mx-auto mt-4 max-w-xl text-lg leading-7 font-semibold text-balance text-fg/90">
            {a.headline}
          </p>
          <button
            type="button"
            onClick={() => {
              flushSync(() => onWhyToggle(true));
              document.getElementById("why")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="rise-in mt-8 inline-flex items-center gap-2 rounded-full border border-[color:color-mix(in_oklab,var(--verdict)_40%,transparent)] bg-surface px-5 py-2.5 text-sm font-bold text-(--verdict) transition hover:bg-[color:color-mix(in_oklab,var(--verdict)_10%,transparent)]"
          >
            {v.why}
            <ChevronIcon className="size-4" />
          </button>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <Section id="why" title={v.why} open={whyOpen} onToggle={onWhyToggle} highlight>
          <div className="space-y-3 text-[15px] leading-7 text-fg/85">
            {a.explanation
              .split(/\n\s*\n/)
              .filter((p) => p.trim())
              .map((p, i) => (
                <p key={i}>{withCitations(p, ids, openSources)}</p>
              ))}
          </div>
          {a.keyFactors.length > 0 && (
            <>
              <h3 className="mt-6 text-[11px] font-bold tracking-widest text-muted uppercase">
                What decides the answer
              </h3>
              <BulletList items={a.keyFactors} />
            </>
          )}
        </Section>

        {a.authorizationPaths.length > 0 && (
          <Section title="Ways to do this legally">
            <div className="flex flex-wrap gap-2">
              {a.authorizationPaths.map((p) => (
                <span key={p} className="rounded-xl bg-accent-soft px-3 py-1.5 text-sm font-semibold text-accent">
                  {p}
                </span>
              ))}
            </div>
          </Section>
        )}

        {(a.questionsForDso.length > 0 || a.dsoEmail) && (
          <Section title="Ask your DSO">
            {a.questionsForDso.length > 0 && <BulletList items={a.questionsForDso} />}
            {a.dsoEmail && (
              <div className="mt-6">
                <EmailDraft text={a.dsoEmail} />
              </div>
            )}
          </Section>
        )}

        {a.assumptions.length > 0 && (
          <Section title="What we assumed">
            <BulletList items={a.assumptions} muted />
            <p className="mt-3 text-sm text-muted">
              If any of these are wrong, edit your question and check again.
            </p>
          </Section>
        )}

        {sources.length > 0 && (
          <Section
            id="sources"
            title={`Official sources (${sources.length})`}
            open={sourcesOpen}
            onToggle={onSourcesToggle}
          >
            <SourceList sources={sources} />
          </Section>
        )}
      </div>
    </section>
  );
}

/** A collapsible block. Pass `open` and `onToggle` to control it; leave them out to let the browser manage it. */
function Section({
  id,
  title,
  open,
  onToggle,
  highlight = false,
  children,
}: {
  id?: string;
  title: string;
  open?: boolean;
  onToggle?: (open: boolean) => void;
  highlight?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      id={id}
      open={open}
      onToggle={onToggle ? (e) => onToggle(e.currentTarget.open) : undefined}
      className={`group scroll-mt-6 rounded-2xl border bg-surface transition-shadow open:shadow-[0_20px_40px_-28px_var(--glow)] ${
        highlight ? "border-[color:color-mix(in_oklab,var(--verdict)_35%,transparent)]" : "border-line"
      }`}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-5 py-4 font-bold select-none [&::-webkit-details-marker]:hidden">
        <span className={highlight ? "text-(--verdict)" : undefined}>{title}</span>
        <ChevronIcon className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      <div className="px-5 pb-5">{children}</div>
    </details>
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
    <div>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold">Email to your DSO</h3>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 text-sm font-semibold transition-colors hover:border-accent/40 hover:bg-accent-soft"
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
    <ol className="space-y-1">
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
                className="text-sm font-semibold text-fg decoration-accent/40 underline-offset-4 hover:underline"
              >
                {s.title}
              </a>
              <p className="truncate text-xs text-accent">{hostname(s.url)}</p>
              <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted">{s.snippet}</p>
            </div>
          </li>
        ))}
    </ol>
  );
}

/** Turns "[1]" or "[1, 2]" in model text into links to the numbered sources. */
function withCitations(text: string, ids: Set<number>, onCite: () => void): ReactNode[] {
  return text.split(/(\[\d+(?:\s*,\s*\d+)*\])/g).map((part, i) => {
    const nums = /^\[[\d,\s]+\]$/.test(part) ? part.slice(1, -1).split(",").map((n) => Number(n.trim())) : null;
    if (!nums || !nums.every((n) => ids.has(n))) return <Fragment key={i}>{part}</Fragment>;
    return (
      <Fragment key={i}>
        {nums.map((n) => (
          <a
            key={n}
            href={`#source-${n}`}
            onClick={onCite}
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

function VerdictIcon({ name, className = "size-5" }: { name: IconName; className?: string }) {
  if (name === "check") return <CheckIcon className={className} />;
  if (name === "x")
    return (
      <svg {...ICON} strokeWidth={2.5} className={className}>
        <path d="M6 6l12 12M18 6 6 18" />
      </svg>
    );
  if (name === "key")
    return (
      <svg {...ICON} className={className}>
        <circle cx="8" cy="15" r="4" />
        <path d="m10.8 12.2 8.7-8.7M17 6l2 2M14.5 8.5l2 2" />
      </svg>
    );
  return (
    <svg {...ICON} strokeWidth={2.5} className={className}>
      <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4.5" />
      <path d="M12 18h.01" />
    </svg>
  );
}

/** A passport entry stamp carrying the verdict word. */
function VerdictStamp({ word, className }: { word: string; className?: string }) {
  return (
    <svg viewBox="-130 -130 260 260" className={className} fill="none" stroke="currentColor" aria-hidden>
      <defs>
        <path id="verdict-stamp-ring" d="M -89 0 A 89 89 0 1 1 89 0 A 89 89 0 1 1 -89 0" />
      </defs>
      <g opacity="0.85">
        <circle r="122" strokeWidth="5" />
        <circle r="110" strokeWidth="2" />
        <circle r="70" strokeWidth="2" />
        <text fill="currentColor" stroke="none" fontSize="15" fontWeight="900" letterSpacing="2.6">
          <textPath href="#verdict-stamp-ring">UNITED STATES OF AMERICA ★ F-1 STUDENT ★</textPath>
        </text>
        <path d="M -48 -30 H 48" strokeWidth="2" />
        <text y="6" textAnchor="middle" fill="currentColor" stroke="none" fontSize="30" fontWeight="1000">
          F-1
        </text>
        <path d="M -48 18 H 48" strokeWidth="2" />
        <text
          y="40"
          textAnchor="middle"
          fill="currentColor"
          stroke="none"
          fontSize={word.length > 10 ? 12 : 15}
          fontWeight="900"
          letterSpacing="1.2"
        >
          {word}
        </text>
      </g>
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg {...ICON} className={className}>
      <path d="m6 9 6 6 6-6" />
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

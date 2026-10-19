"use client";

import { Fragment, useState, type FormEvent, type ReactNode } from "react";
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

const VERDICT_STYLE: Record<Verdict, { label: string; className: string }> = {
  likely_allowed: {
    label: "Likely allowed",
    className:
      "bg-emerald-50 text-emerald-800 ring-emerald-600/25 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/30",
  },
  needs_authorization: {
    label: "Needs authorization first",
    className:
      "bg-amber-50 text-amber-800 ring-amber-600/25 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/30",
  },
  likely_not_allowed: {
    label: "Likely not allowed",
    className:
      "bg-rose-50 text-rose-800 ring-rose-600/25 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/30",
  },
  unclear: {
    label: "Unclear: ask your DSO",
    className:
      "bg-zinc-100 text-zinc-700 ring-zinc-500/25 dark:bg-zinc-500/10 dark:text-zinc-300 dark:ring-zinc-400/30",
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
    <div className="flex flex-1 flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:py-16">
        <header className="mb-8">
          <div className="flex items-center gap-2.5">
            <CompassIcon />
            <span className="text-lg font-semibold tracking-tight">F1 Compass</span>
          </div>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Know before you work.
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-400">
            Describe something you want to do. F1 Compass searches official U.S. government
            sources and explains whether F-1 rules likely allow it, with citations and an
            email you can send to your school&apos;s international office.
          </p>
        </header>

        <form onSubmit={check} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-5">
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
            className="mt-2 w-full resize-y rounded-xl border border-zinc-300 bg-white px-3.5 py-3 text-base leading-6 outline-none placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:placeholder:text-zinc-500"
          />

          <div className="mt-3 flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setQuestion(ex)}
                className="rounded-full border border-zinc-200 px-3 py-1 text-left text-sm text-zinc-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-indigo-500/50 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300"
              >
                {ex}
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor="school" className="text-sm font-medium">
                Your school&apos;s international office site{" "}
                <span className="font-normal text-zinc-500">(optional)</span>
              </label>
              <input
                id="school"
                value={schoolDomain}
                onChange={(e) => setSchoolDomain(e.target.value)}
                placeholder="isss.illinois.edu"
                className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-base outline-none placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:placeholder:text-zinc-500"
              />
            </div>
            <button
              type="submit"
              disabled={running || !question.trim()}
              className="h-11 rounded-xl bg-indigo-600 px-6 font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {running ? "Checking…" : "Check it"}
            </button>
          </div>
        </form>

        {showProgress && (
          <Progress step={step} detail={stepDetail} done={result !== null} failed={error !== null} />
        )}

        {error && (
          <div role="alert" className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </div>
        )}

        {result && <ResultView result={result} sources={sources} />}

        {!result && sources.length > 0 && <SourceList sources={sources} />}
      </main>

      <footer className="border-t border-zinc-200 px-4 py-6 text-center text-xs leading-5 text-zinc-500 dark:border-zinc-800">
        <p className="mx-auto max-w-2xl">
          F1 Compass gives general information, not legal advice. Immigration rules depend on
          your exact facts. Always confirm with your school&apos;s Designated School Official
          (DSO) before acting.
        </p>
        <p className="mt-2">Powered by NVIDIA Nemotron on Nebius Token Factory · Search by Tavily</p>
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
    <ol className="mt-6 grid gap-2 sm:grid-cols-3">
      {STEPS.map((s, i) => {
        const state = done || i < current ? "done" : i === current ? "active" : "pending";
        return (
          <li
            key={s.id}
            className="flex items-start gap-2.5 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center">
              {state === "done" ? (
                <svg viewBox="0 0 20 20" className="size-5 text-emerald-600 dark:text-emerald-400" fill="currentColor" aria-hidden>
                  <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
                </svg>
              ) : state === "active" && !failed ? (
                <span className="size-4 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600 dark:border-indigo-500/30 dark:border-t-indigo-400" />
              ) : (
                <span className="size-2 rounded-full bg-zinc-300 dark:bg-zinc-600" />
              )}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">{s.label}</span>
              {detail[s.id] && (
                <span className="block truncate font-mono text-xs text-zinc-500">{detail[s.id]}</span>
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
        <p className="rounded-xl border border-dashed border-amber-400 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
          Mock mode: this is sample data, not a real analysis. Set MOCK_MODE=0 and add API keys to run real checks.
        </p>
      )}

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
        <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset ${verdict.className}`}>
          {verdict.label}
        </span>
        <h2 className="mt-3 text-xl font-semibold leading-snug tracking-tight text-balance">{a.headline}</h2>
        <div className="mt-4 space-y-3 text-[15px] leading-7 text-zinc-700 dark:text-zinc-300">
          {a.explanation
            .split(/\n\s*\n/)
            .filter((p) => p.trim())
            .map((p, i) => (
              <p key={i}>{withCitations(p, ids)}</p>
            ))}
        </div>

        {a.authorizationPaths.length > 0 && (
          <div className="mt-5">
            <h3 className="text-sm font-semibold">Ways to do this legally</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {a.authorizationPaths.map((p) => (
                <span key={p} className="rounded-lg bg-indigo-50 px-2.5 py-1 text-sm font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="What decides the answer" items={a.keyFactors} />
        <Card title="Ask your DSO" items={a.questionsForDso} />
      </div>

      {a.dsoEmail && <EmailDraft text={a.dsoEmail} />}

      {a.assumptions.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-sm font-semibold">We assumed</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            {a.assumptions.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-zinc-500">
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
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        {items.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    </div>
  );
}

function EmailDraft({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Email to your DSO</h3>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="rounded-lg border border-zinc-200 px-3 py-1 text-sm font-medium transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-zinc-50 p-4 font-sans text-sm leading-6 text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
        {text}
      </pre>
    </div>
  );
}

function SourceList({ sources }: { sources: Source[] }) {
  if (!sources.length) return null;
  return (
    <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-sm font-semibold">Official sources</h3>
      <ol className="mt-3 space-y-3">
        {sources.map((s) => (
          <li key={s.id} id={`source-${s.id}`} className="scroll-mt-6 flex gap-3">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-zinc-100 font-mono text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {s.id}
            </span>
            <div className="min-w-0">
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-indigo-700 hover:underline dark:text-indigo-300"
              >
                {s.title}
              </a>
              <p className="truncate text-xs text-zinc-500">{hostname(s.url)}</p>
              <p className="mt-1 line-clamp-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{s.snippet}</p>
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
            className="mx-0.5 rounded bg-indigo-50 px-1 align-[0.1em] font-mono text-[0.75em] font-semibold text-indigo-700 no-underline hover:bg-indigo-100 dark:bg-indigo-500/15 dark:text-indigo-300"
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

function CompassIcon() {
  return (
    <svg viewBox="0 0 32 32" className="size-8" aria-hidden>
      <rect width="32" height="32" rx="8" className="fill-indigo-600" />
      <circle cx="16" cy="16" r="9" fill="none" stroke="white" strokeWidth="1.75" opacity="0.9" />
      <path d="M19.5 12.5 17.2 17.2 12.5 19.5 14.8 14.8Z" fill="white" />
    </svg>
  );
}

// Sends every question in evals/cases.csv to a running F1 Compass server and reports accuracy.
// Start the app first (npm run dev), then: npm run eval
// Options: EVAL_URL (default http://localhost:3000), EVAL_LIMIT, EVAL_CONCURRENCY (default 2),
//          EVAL_IDS (comma-separated case ids, e.g. "24,26,28", to rerun only those)

import { readFile, writeFile } from "node:fs/promises";

const BASE = (process.env.EVAL_URL || "http://localhost:3000").replace(/\/$/, "");
const LIMIT = Number(process.env.EVAL_LIMIT) || Infinity;
const CONCURRENCY = Number(process.env.EVAL_CONCURRENCY) || 2;
const IDS = (process.env.EVAL_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Plain words in the spreadsheet → verdict values the app returns.
const EXPECTED = {
  allowed: "likely_allowed",
  needs_authorization: "needs_authorization",
  not_allowed: "likely_not_allowed",
  unclear: "unclear",
};

function parseCsv(text) {
  text = text.replace(/^﻿/, "");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((r) => r.some((v) => v.trim()));
  return body.map((r) =>
    Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()])),
  );
}

async function check(question) {
  const res = await fetch(`${BASE}/api/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  let result = null;
  for (const line of (await res.text()).split("\n")) {
    if (!line.trim()) continue;
    const event = JSON.parse(line);
    if (event.type === "error") throw new Error(event.message);
    if (event.type === "result") result = event;
  }
  if (!result) throw new Error("The server closed the stream without a result.");
  return result;
}

const md = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();

try {
  await fetch(BASE, { method: "HEAD" });
} catch {
  console.error(`Can't reach ${BASE}. Start the app first with: npm run dev`);
  process.exit(1);
}

const all = parseCsv(await readFile(new URL("../evals/cases.csv", import.meta.url), "utf8"));
const cases = [];
for (const c of all) {
  if (!c.question) continue;
  if (!EXPECTED[c.expected]) {
    console.warn(`Skipping #${c.id}: expected must be one of ${Object.keys(EXPECTED).join(", ")} (got "${c.expected}")`);
    continue;
  }
  cases.push(c);
}
const todo = (IDS.length ? cases.filter((c) => IDS.includes(c.id)) : cases).slice(0, LIMIT);
console.log(`Running ${todo.length} case(s) against ${BASE}, ${CONCURRENCY} at a time…\n`);

const results = new Array(todo.length);
let next = 0;
let mock = false;
let models = null;

async function worker() {
  while (next < todo.length) {
    const i = next++;
    const c = todo[i];
    const expected = EXPECTED[c.expected];
    const started = Date.now();
    try {
      const r = await check(c.question);
      mock ||= r.mock;
      models ??= r.models;
      const got = r.assessment.verdict;
      const match = got === expected;
      const dangerous = got === "likely_allowed" && expected !== "likely_allowed";
      results[i] = { c, expected, got, match, dangerous, headline: r.assessment.headline };
      const secs = ((Date.now() - started) / 1000).toFixed(0);
      console.log(
        `${match ? "✓" : "✗"} #${c.id} ${match ? got : `expected ${expected}, got ${got}`}${dangerous ? "  ⚠ DANGEROUS" : ""}  (${secs}s)`,
      );
    } catch (err) {
      results[i] = { c, expected, error: err.message };
      console.log(`! #${c.id} error: ${err.message}`);
    }
  }
}

await Promise.all(Array.from({ length: Math.min(CONCURRENCY, todo.length) }, worker));

const answered = results.filter((r) => !r.error);
const correct = answered.filter((r) => r.match).length;
const dangerous = answered.filter((r) => r.dangerous).length;
const errors = results.length - answered.length;
const pct = answered.length ? ((100 * correct) / answered.length).toFixed(0) : "0";

console.log(`\nAccuracy: ${correct}/${answered.length} (${pct}%)   Dangerous: ${dangerous}   Errors: ${errors}`);
if (mock) console.log("MOCK MODE: these are canned sample answers, not a real evaluation.");

const lines = [
  "# Accuracy results",
  "",
  `Run on ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC against ${BASE}.`,
  models ? `Models: \`${models.fast}\` (planning), \`${models.reasoning}\` (analysis).` : "",
  mock ? "\n**Mock mode: canned sample answers, not a real evaluation.**" : "",
  "",
  `**Accuracy: ${correct}/${answered.length} (${pct}%)** · Dangerous errors: ${dangerous} · Errors: ${errors}`,
  "",
  "| # | Question | Expected | Got | |",
  "|---|---|---|---|---|",
  ...results.map((r) =>
    `| ${md(r.c.id)} | ${md(r.c.question)} | ${r.expected} | ${r.error ? `error: ${md(r.error)}` : r.got} | ${
      r.error ? "!" : r.match ? "✓" : r.dangerous ? "⚠ dangerous" : "✗"
    } |`,
  ),
  "",
];
await writeFile(new URL("../evals/results.md", import.meta.url), lines.filter((l) => l !== null).join("\n"));
console.log("Saved evals/results.md");

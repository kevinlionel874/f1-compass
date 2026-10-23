import { APIConnectionTimeoutError } from "openai";
import { getConfig, OFFICIAL_DOMAINS, type Config } from "./config";
import { runMock } from "./mock";
import { chatJson } from "./nebius";
import {
  ANALYZE_SYSTEM,
  buildAnalysisPrompt,
  buildHomePrompt,
  HOME_SYSTEM,
  PLAN_SYSTEM,
} from "./prompts";
import { searchOfficialSources } from "./tavily";
import {
  VERDICTS,
  type Assessment,
  type CheckInput,
  type HomeOptions,
  type Plan,
  type StreamEvent,
  type Verdict,
} from "./types";

/**
 * The whole check, in three steps:
 * 1. Nemotron 3 Nano and Super race to restate the question and write search queries,
 * 2. Tavily searches official government sources only,
 * 3. a reasoning Nemotron model reads the sources and writes a cited assessment.
 */
export async function runCheck(
  input: CheckInput,
  send: (event: StreamEvent) => void,
): Promise<void> {
  const config = getConfig();
  if (config.mock) return runMock(input, send);

  if (!config.nebiusApiKey) {
    throw new Error("The server is missing NEBIUS_API_KEY. Add it to .env.local (see README).");
  }
  if (!config.tavilyApiKey) {
    throw new Error("The server is missing TAVILY_API_KEY. Add it to .env.local (see README).");
  }

  // Home-country suggestions run alongside the main check and never hold it up or fail it.
  const homeTask = input.homeCountry
    ? suggestHomeRoles(config, input.question, input.homeCountry)
        .then((homeOptions) => send({ type: "homeOptions", homeOptions }))
        .catch((err) => console.warn(`Home-country suggestions skipped: ${errorMessage(err)}`))
    : Promise.resolve();

  send({ type: "status", step: "plan", message: "Nemotron Nano + Super, fastest wins" });
  let plan: Plan;
  let planModel: string;
  try {
    const winner = await planWithFastestModel(config, input.question);
    plan = winner.plan;
    planModel = winner.model;
    send({ type: "status", step: "plan", message: winner.model });
  } catch (err) {
    // Planning only shapes the search queries, so slow or failed planners shouldn't stall the check.
    console.warn(`Planners unavailable, using backup queries: ${errorMessage(err)}`);
    plan = backupPlan(input.question);
    planModel = "backup queries";
    send({ type: "status", step: "plan", message: "backup queries (fast models were slow)" });
  }
  send({ type: "plan", plan });

  send({ type: "status", step: "search", message: "Tavily · official .gov sources" });
  const domains = input.schoolDomain
    ? [...OFFICIAL_DOMAINS, input.schoolDomain]
    : OFFICIAL_DOMAINS;
  const sources = await searchOfficialSources(
    plan.queries,
    domains,
    config.tavilyApiKey,
    config.searchDepth,
  );
  send({ type: "sources", sources });

  send({ type: "status", step: "analyze", message: config.reasoningModel });
  let raw: unknown;
  try {
    raw = await chatJson(
      config,
      config.reasoningModel,
      ANALYZE_SYSTEM,
      buildAnalysisPrompt(input.question, plan, sources),
      6000,
      { timeoutMs: config.analysisTimeoutMs, maxRetries: 1 },
    );
  } catch (err) {
    if (err instanceof APIConnectionTimeoutError) {
      throw new Error("The analysis is taking longer than usual. Please try again in a minute.");
    }
    throw err;
  }
  const assessment = toAssessment(raw);

  send({
    type: "result",
    assessment,
    models: { fast: planModel, reasoning: config.reasoningModel },
    mock: false,
  });

  // Keep the stream open until the suggestions arrive (they usually already have).
  await homeTask;
}

/** Roles close to the student's question that they could do in their home country while physically there. */
async function suggestHomeRoles(
  config: Config,
  question: string,
  country: string,
): Promise<HomeOptions> {
  const raw = await chatJson(
    config,
    config.fastModel2,
    HOME_SYSTEM,
    buildHomePrompt(question, country),
    1500,
    { timeoutMs: 25000, maxRetries: 0 },
  );
  const obj = (raw ?? {}) as Record<string, unknown>;
  const roles = (Array.isArray(obj.roles) ? obj.roles : [])
    .map((r) => {
      const role = (r ?? {}) as Record<string, unknown>;
      return {
        title: str(role.title),
        whyItFits: str(role.whyItFits),
        howToFind: str(role.howToFind),
      };
    })
    .filter((r) => r.title)
    .slice(0, 3);
  if (!roles.length) throw new Error("no roles in the model's answer");
  return {
    country,
    roles,
    caveat: str(
      obj.caveat,
      "Confirm with your DSO before working remotely from abroad during the semester, and follow your home country's tax and labor rules.",
    ),
  };
}

/**
 * Asks Nano and Super for the plan at the same time and keeps whichever answers first;
 * the other request is cancelled. Rejects if neither answers within the plan timeout.
 */
async function planWithFastestModel(
  config: Config,
  question: string,
): Promise<{ plan: Plan; model: string }> {
  const models = [config.fastModel, config.fastModel2];
  const controllers = models.map(() => new AbortController());
  return Promise.any(
    models.map(async (model, i) => {
      const raw = await chatJson(config, model, PLAN_SYSTEM, question, 1500, {
        timeoutMs: config.planTimeoutMs,
        maxRetries: 0,
        signal: controllers[i].signal,
      });
      controllers.forEach((c, j) => j !== i && c.abort());
      return { plan: toPlan(raw, question), model };
    }),
  );
}

/** Used when both planners are slow or down: search from the student's own words plus the core rules. */
function backupPlan(question: string): Plan {
  const q = question.slice(0, 250);
  return {
    summary: question,
    assumptions: [
      "You are in F-1 status and not currently on OPT.",
      "You are physically in the United States while doing the work.",
    ],
    queries: [
      `F-1 student employment authorization rules ${q}`,
      "F-1 student on-campus and off-campus employment rules CPT OPT",
    ],
  };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// Model output is untrusted: coerce it into the shape the UI expects.

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function strList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string" && v.trim() !== "")
    .map((v) => v.trim())
    .slice(0, max);
}

function toPlan(raw: unknown, question: string): Plan {
  const obj = (raw ?? {}) as Record<string, unknown>;
  // Two queries keep each check at 2-4 Tavily credits.
  const queries = strList(obj.queries, 2);
  return {
    summary: str(obj.summary, question),
    assumptions: strList(obj.assumptions, 6),
    queries: queries.length ? queries : [`F-1 student employment rules ${question}`.slice(0, 300)],
  };
}

function toAssessment(raw: unknown): Assessment {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const verdict = VERDICTS.includes(obj.verdict as Verdict)
    ? (obj.verdict as Verdict)
    : "unclear";
  return {
    verdict,
    headline: str(obj.headline, "We couldn't reach a confident answer. Please ask your DSO."),
    explanation: str(obj.explanation),
    keyFactors: strList(obj.keyFactors, 5),
    authorizationPaths: strList(obj.authorizationPaths, 3),
    questionsForDso: strList(obj.questionsForDso, 4),
    dsoEmail: str(obj.dsoEmail),
    assumptions: strList(obj.assumptions, 6),
  };
}

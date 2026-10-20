import { getConfig, OFFICIAL_DOMAINS } from "./config";
import { runMock } from "./mock";
import { chatJson } from "./nebius";
import { ANALYZE_SYSTEM, buildAnalysisPrompt, PLAN_SYSTEM } from "./prompts";
import { searchOfficialSources } from "./tavily";
import {
  VERDICTS,
  type Assessment,
  type CheckInput,
  type Plan,
  type StreamEvent,
  type Verdict,
} from "./types";

/**
 * The whole check, in three steps:
 * 1. Nemotron 3 Nano (fast) restates the question and writes search queries,
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

  send({ type: "status", step: "plan", message: config.fastModel });
  const plan = toPlan(
    await chatJson(config, config.fastModel, PLAN_SYSTEM, input.question, 1500),
    input.question,
  );
  send({ type: "plan", plan });

  send({ type: "status", step: "search", message: "Tavily · official .gov sources" });
  const domains = input.schoolDomain
    ? [...OFFICIAL_DOMAINS, input.schoolDomain]
    : OFFICIAL_DOMAINS;
  const sources = await searchOfficialSources(plan.queries, domains, config.tavilyApiKey);
  send({ type: "sources", sources });

  send({ type: "status", step: "analyze", message: config.reasoningModel });
  const assessment = toAssessment(
    await chatJson(
      config,
      config.reasoningModel,
      ANALYZE_SYSTEM,
      buildAnalysisPrompt(input.question, plan, sources),
      6000,
    ),
  );

  send({
    type: "result",
    assessment,
    models: { fast: config.fastModel, reasoning: config.reasoningModel },
    mock: false,
  });
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
  const queries = strList(obj.queries, 3);
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

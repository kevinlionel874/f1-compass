export type Verdict =
  | "likely_allowed"
  | "needs_authorization"
  | "likely_not_allowed"
  | "unclear";

export const VERDICTS: readonly Verdict[] = [
  "likely_allowed",
  "needs_authorization",
  "likely_not_allowed",
  "unclear",
];

/** Output of the fast "planner" model: what we understood and what to search for. */
export interface Plan {
  summary: string;
  assumptions: string[];
  queries: string[];
}

/** One search result from an official source, numbered for citations. */
export interface Source {
  id: number;
  title: string;
  url: string;
  snippet: string;
}

/** Output of the reasoning model: the answer shown to the student. */
export interface Assessment {
  verdict: Verdict;
  headline: string;
  explanation: string;
  keyFactors: string[];
  authorizationPaths: string[];
  questionsForDso: string[];
  dsoEmail: string;
  assumptions: string[];
}

/** A kind of work, similar to what the student asked about, they could do in their home country. */
export interface HomeRole {
  title: string;
  whyItFits: string;
  howToFind: string;
}

export interface HomeOptions {
  country: string;
  roles: HomeRole[];
  caveat: string;
}

export type Step = "plan" | "search" | "analyze";

/** Events streamed from /api/check to the browser, one JSON object per line. */
export type StreamEvent =
  | { type: "status"; step: Step; message: string }
  | { type: "plan"; plan: Plan }
  | { type: "sources"; sources: Source[] }
  | {
      type: "result";
      assessment: Assessment;
      models: { fast: string; reasoning: string };
      mock: boolean;
    }
  | { type: "homeOptions"; homeOptions: HomeOptions }
  | { type: "error"; message: string };

export interface CheckInput {
  question: string;
  schoolDomain?: string;
  homeCountry?: string;
}

import type { CheckInput, StreamEvent } from "./types";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * MOCK_MODE=1: streams a canned sample so the UI can be built and tested without API keys.
 * The UI labels these results as sample data. Never record the demo video in this mode.
 */
export async function runMock(
  input: CheckInput,
  send: (event: StreamEvent) => void,
): Promise<void> {
  send({ type: "status", step: "plan", message: "mock: fast model" });
  await wait(700);
  send({
    type: "plan",
    plan: {
      summary: `Sample restatement of: "${input.question.slice(0, 160)}"`,
      assumptions: [
        "You are in F-1 status and not currently on OPT.",
        "You are physically in the United States while doing the work.",
        "You would be paid for the work.",
      ],
      queries: [
        "F-1 student off-campus employment authorization",
        "F-1 student self-employment freelance foreign client",
      ],
    },
  });

  send({ type: "status", step: "search", message: "mock: Tavily" });
  await wait(900);
  send({
    type: "sources",
    sources: [
      {
        id: 1,
        title: "Students and Employment | USCIS",
        url: "https://www.uscis.gov/working-in-the-united-states/students-and-exchange-visitors/students-and-employment",
        snippet: "Sample snippet (mock mode). The live app shows the text Tavily returns from this page.",
      },
      {
        id: 2,
        title: "8 CFR 214.2 — Special requirements for admission, extension, and maintenance of status",
        url: "https://www.ecfr.gov/current/title-8/chapter-I/subchapter-B/part-214/section-214.2",
        snippet: "Sample snippet (mock mode). The live app shows the text Tavily returns from this page.",
      },
      {
        id: 3,
        title: "Working in the United States | Study in the States",
        url: "https://studyinthestates.dhs.gov/students/work/working-in-the-united-states",
        snippet: "Sample snippet (mock mode). The live app shows the text Tavily returns from this page.",
      },
    ],
  });

  send({ type: "status", step: "analyze", message: "mock: reasoning model" });
  await wait(1400);
  send({
    type: "result",
    mock: true,
    models: { fast: "mock", reasoning: "mock" },
    assessment: {
      verdict: "likely_not_allowed",
      headline:
        "Freelancing while you are physically in the U.S. generally counts as unauthorized employment for F-1 students.",
      explanation:
        "This is sample text from mock mode. In the live app, a Nemotron model writes this explanation from the official sources listed below, citing them like this [1].\n\nThe key question is where the work is physically performed, not where the client is or where the money is paid [2]. Off-campus work generally requires CPT or OPT first [3].",
      keyFactors: [
        "Where you physically do the work",
        "Whether you are paid or receive anything of value",
        "Whether you have CPT or OPT authorization",
      ],
      authorizationPaths: ["CPT", "OPT"],
      questionsForDso: [
        "Does freelance work for a client outside the U.S. count as employment if I do it while in Illinois?",
        "Could this work qualify for CPT through a course in my major?",
      ],
      dsoEmail:
        "Hello,\n\nI'm an F-1 student and I've been offered paid freelance web development work by a client in China. I would do the work from Illinois. Could you tell me whether this is allowed, or whether I would need CPT or OPT first?\n\nThank you,\n[Your name]\n[Student ID]",
      assumptions: [
        "You are in F-1 status and not currently on OPT.",
        "You are physically in the United States while doing the work.",
      ],
    },
  });
}

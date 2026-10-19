/** Official sources we let Tavily search. Keeping results to these domains is what makes answers trustworthy. */
export const OFFICIAL_DOMAINS = [
  "uscis.gov",
  "ice.gov",
  "studyinthestates.dhs.gov",
  "ecfr.gov",
  "law.cornell.edu",
  "irs.gov",
  "travel.state.gov",
];

export function getConfig() {
  return {
    nebiusApiKey: process.env.NEBIUS_API_KEY ?? "",
    nebiusBaseUrl:
      process.env.NEBIUS_BASE_URL || "https://api.tokenfactory.nebius.com/v1",
    // Model IDs differ by account; run `npm run models` to list the exact ones your key can use.
    fastModel:
      process.env.NEBIUS_FAST_MODEL || "nvidia/nemotron-3-super-120b-a12b",
    reasoningModel:
      process.env.NEBIUS_REASONING_MODEL || "nvidia/Nemotron-3-Ultra-550b-a55b",
    tavilyApiKey: process.env.TAVILY_API_KEY ?? "",
    mock: process.env.MOCK_MODE === "1",
  };
}

export type Config = ReturnType<typeof getConfig>;

/** Turns "https://isss.illinois.edu/foo" or "isss.illinois.edu" into "isss.illinois.edu"; rejects anything else. */
export function normalizeDomain(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const host = value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split(/[/?#]/)[0];
  return /^([a-z0-9-]+\.)+[a-z]{2,}$/.test(host) ? host : undefined;
}

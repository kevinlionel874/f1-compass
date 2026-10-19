import type { Source } from "./types";

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

async function search(
  query: string,
  domains: string[],
  apiKey: string,
): Promise<TavilyResult[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      search_depth: "advanced",
      max_results: 5,
      include_domains: domains,
    }),
  });
  if (!res.ok) {
    throw new Error(`Tavily search failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { results?: TavilyResult[] };
  return data.results ?? [];
}

/** The same page often comes back as both "www.uscis.gov/x/" and "uscis.gov/x"; treat those as one. */
function pageKey(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "") + u.pathname.replace(/\/+$/, "") + u.search;
  } catch {
    return url;
  }
}

/** Runs every query in parallel, removes duplicate pages, and keeps the best matches. */
export async function searchOfficialSources(
  queries: string[],
  domains: string[],
  apiKey: string,
  limit = 8,
): Promise<Source[]> {
  const batches = await Promise.all(
    queries.map((q) => search(q, domains, apiKey)),
  );

  const byUrl = new Map<string, TavilyResult>();
  for (const result of batches.flat()) {
    const key = pageKey(result.url);
    const existing = byUrl.get(key);
    if (!existing || result.score > existing.score) byUrl.set(key, result);
  }

  return [...byUrl.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r, i) => ({
      id: i + 1,
      title: r.title || r.url,
      url: r.url,
      snippet: r.content.slice(0, 1500),
    }));
}

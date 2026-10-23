import type { Source } from "./types";

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export type SearchDepth = "basic" | "advanced";

// Identical searches within a day reuse earlier results. Official pages change rarely, people
// (and judges) tend to click the same examples, and every search spends Tavily credits.
// The cache lives in server memory, so it only helps while an instance stays warm.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 300;
const cache = new Map<string, { at: number; results: TavilyResult[] }>();

async function search(
  query: string,
  domains: string[],
  apiKey: string,
  depth: SearchDepth,
): Promise<TavilyResult[]> {
  const key = `${depth}|${domains.join(",")}|${query.trim().toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.results;

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      search_depth: depth,
      max_results: 5,
      include_domains: domains,
    }),
  });
  if (!res.ok) {
    throw new Error(`Tavily search failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { results?: TavilyResult[] };
  const results = data.results ?? [];

  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(key, { at: Date.now(), results });
  return results;
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
  depth: SearchDepth,
  limit = 8,
): Promise<Source[]> {
  const batches = await Promise.all(
    queries.map((q) => search(q, domains, apiKey, depth)),
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

import OpenAI from "openai";
import type { Config } from "./config";

export interface CallLimits {
  /** Give up on a single request after this many milliseconds. */
  timeoutMs: number;
  /** How many times the SDK retries timeouts, network errors and 5xx responses. */
  maxRetries: number;
  /** Cancels the request, e.g. when another model already answered. */
  signal?: AbortSignal;
}

/** Calls a model on Nebius Token Factory (OpenAI-compatible API) and parses the JSON it returns. */
export async function chatJson(
  config: Config,
  model: string,
  system: string,
  user: string,
  maxTokens: number,
  limits: CallLimits,
): Promise<unknown> {
  const client = new OpenAI({
    apiKey: config.nebiusApiKey,
    baseURL: config.nebiusBaseUrl,
  });

  // Temperature 0 keeps the verdict for the same question stable from run to run.
  // Models occasionally emit malformed JSON; the retry adds a little randomness
  // so it doesn't repeat the same mistake.
  for (const temperature of [0, 0.3]) {
    const completion = await client.chat.completions.create(
      {
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature,
        max_tokens: maxTokens,
      },
      { timeout: limits.timeoutMs, maxRetries: limits.maxRetries, signal: limits.signal },
    );
    const json = extractJson(completion.choices[0]?.message?.content ?? "");
    if (json !== undefined) return json;
  }
  throw new Error(`${model} returned an answer we couldn't read. Please try again.`);
}

/** Reasoning models may wrap JSON in <think> blocks or code fences; pull out the object itself. */
function extractJson(text: string): unknown {
  const cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```(?:json)?/gi, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return undefined;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return undefined;
  }
}

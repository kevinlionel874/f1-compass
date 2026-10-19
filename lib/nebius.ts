import OpenAI from "openai";
import type { Config } from "./config";

/** Calls a model on Nebius Token Factory (OpenAI-compatible API) and parses the JSON it returns. */
export async function chatJson(
  config: Config,
  model: string,
  system: string,
  user: string,
  maxTokens: number,
): Promise<unknown> {
  const client = new OpenAI({
    apiKey: config.nebiusApiKey,
    baseURL: config.nebiusBaseUrl,
  });

  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.2,
    max_tokens: maxTokens,
  });

  const text = completion.choices[0]?.message?.content ?? "";
  return extractJson(text, model);
}

/** Reasoning models may wrap JSON in <think> blocks or code fences; pull out the object itself. */
function extractJson(text: string, model: string): unknown {
  const cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```(?:json)?/gi, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error(`${model} did not return JSON. Try again or switch models.`);
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

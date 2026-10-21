import { normalizeCountry, normalizeDomain } from "@/lib/config";
import { runCheck } from "@/lib/pipeline";
import type { StreamEvent } from "@/lib/types";

// The reasoning model can take a while; give the serverless function room on Vercel.
export const maxDuration = 120;

export async function POST(request: Request) {
  let body: { question?: unknown; schoolDomain?: unknown; homeCountry?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) {
    return Response.json({ error: "Please describe what you want to do." }, { status: 400 });
  }
  if (question.length > 2000) {
    return Response.json({ error: "Please keep your question under 2,000 characters." }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Side work (home-country suggestions) can finish after an error closed the stream; drop it then.
      let closed = false;
      const send = (event: StreamEvent) => {
        if (!closed) controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };
      try {
        await runCheck(
          {
            question,
            schoolDomain: normalizeDomain(body.schoolDomain),
            homeCountry: normalizeCountry(body.homeCountry),
          },
          send,
        );
      } catch (err) {
        console.error(err);
        send({
          type: "error",
          message: err instanceof Error ? err.message : "Something went wrong.",
        });
      } finally {
        closed = true;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

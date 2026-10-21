"use client";

/**
 * A script that runs while the browser parses the server HTML, before first paint.
 * On the client it renders as text/plain so React doesn't warn about script tags;
 * suppressHydrationWarning accepts the type difference. (Next.js "Preventing Flash" guide.)
 */
export default function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

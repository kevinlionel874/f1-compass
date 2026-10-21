"use client";

import { useEffect, useLayoutEffect, useSyncExternalStore } from "react";
import {
  ACCENTS,
  DEFAULT_ACCENT,
  applyTheme,
  readStoredTheme,
  saveTheme,
  type Mode,
} from "@/lib/theme";

// The current theme lives on <html> (set by the head script before paint), so read it from there.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-accent", "data-mode"],
  });
  return () => observer.disconnect();
}

function getSnapshot() {
  const root = document.documentElement;
  return `${root.dataset.accent ?? DEFAULT_ACCENT}|${root.dataset.mode ?? "system"}`;
}

function getServerSnapshot() {
  return `${DEFAULT_ACCENT}|system`;
}

const NEXT_MODE: Record<Mode, Mode> = { system: "light", light: "dark", dark: "system" };
const MODE_LABEL: Record<Mode, string> = { system: "Match system", light: "Light", dark: "Dark" };

export default function ThemePicker() {
  const [accent, mode] = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot).split(
    "|",
  ) as [string, Mode];

  // In development React's remount clears the attributes the head script set; put them back.
  useLayoutEffect(() => {
    const stored = readStoredTheme();
    applyTheme(stored.accent, stored.mode);
  }, []);

  // While following the system, track OS light/dark changes live.
  useEffect(() => {
    if (mode !== "system") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme(accent, "system");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [accent, mode]);

  const next = NEXT_MODE[mode];

  return (
    <div
      role="group"
      aria-label="Color theme"
      className="flex items-center gap-1.5 rounded-full border border-line bg-surface/70 p-1.5 shadow-sm backdrop-blur-md"
    >
      {ACCENTS.map((a) => (
        <button
          key={a.id}
          type="button"
          aria-label={`${a.label} theme`}
          aria-pressed={accent === a.id}
          title={a.label}
          onClick={() => saveTheme(a.id, mode)}
          style={{ backgroundColor: a.swatch }}
          className="size-5 rounded-full ring-1 ring-black/10 ring-inset transition-transform hover:scale-110 aria-pressed:ring-2 aria-pressed:ring-fg aria-pressed:ring-offset-2 aria-pressed:ring-offset-surface dark:ring-white/15 motion-reduce:transition-none"
        />
      ))}
      <span className="mx-0.5 h-5 w-px bg-line" aria-hidden />
      <button
        type="button"
        onClick={() => saveTheme(accent, next)}
        aria-label={`Color mode: ${MODE_LABEL[mode]}. Switch to ${MODE_LABEL[next]}.`}
        title={MODE_LABEL[mode]}
        className="flex size-7 items-center justify-center rounded-full text-muted transition-colors hover:bg-accent-soft hover:text-fg"
      >
        <ModeIcon mode={mode} />
      </button>
    </div>
  );
}

function ModeIcon({ mode }: { mode: Mode }) {
  const common = {
    viewBox: "0 0 24 24",
    className: "size-4",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (mode === "light") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    );
  }
  if (mode === "dark") {
    return (
      <svg {...common}>
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}

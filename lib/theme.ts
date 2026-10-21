export const ACCENTS = [
  { id: "indigo", label: "Indigo", swatch: "#4f46e5" },
  { id: "ocean", label: "Ocean", swatch: "#0369a1" },
  { id: "plum", label: "Plum", swatch: "#9333ea" },
  { id: "sunset", label: "Sunset", swatch: "#c2410c" },
  { id: "graphite", label: "Graphite", swatch: "#3f3f46" },
] as const;

export type Mode = "system" | "light" | "dark";

export const DEFAULT_ACCENT = "indigo";
const ACCENT_KEY = "f1-accent";
const MODE_KEY = "f1-mode";

/**
 * Runs in <head> before the first paint so a saved theme never flashes.
 * Mirrors applyTheme below; keep the two in sync.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var d=document.documentElement,a=localStorage.getItem("${ACCENT_KEY}")||"${DEFAULT_ACCENT}",m=localStorage.getItem("${MODE_KEY}")||"system",k=m==="dark"||(m==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);d.setAttribute("data-accent",a);d.setAttribute("data-mode",m);d.setAttribute("data-theme",k?"dark":"light")}catch(e){}})()`;

export function applyTheme(accent: string, mode: Mode) {
  const dark =
    mode === "dark" ||
    (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const root = document.documentElement;
  root.setAttribute("data-accent", accent);
  root.setAttribute("data-mode", mode);
  root.setAttribute("data-theme", dark ? "dark" : "light");
}

export function readStoredTheme(): { accent: string; mode: Mode } {
  try {
    const mode = localStorage.getItem(MODE_KEY);
    return {
      accent: localStorage.getItem(ACCENT_KEY) || DEFAULT_ACCENT,
      mode: mode === "light" || mode === "dark" ? mode : "system",
    };
  } catch {
    return { accent: DEFAULT_ACCENT, mode: "system" };
  }
}

export function saveTheme(accent: string, mode: Mode) {
  try {
    localStorage.setItem(ACCENT_KEY, accent);
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // Private windows can refuse storage; the theme still applies for this visit.
  }
  applyTheme(accent, mode);
}

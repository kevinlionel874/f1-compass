import type { Metadata } from "next";
import { Geist_Mono, Nunito } from "next/font/google";
import InlineScript from "@/components/InlineScript";
import { DEFAULT_ACCENT, THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

// Rounded, sturdy letterforms for everything except code-like labels.
const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "F1 Compass: Know before you work",
  description:
    "Check whether F-1 visa rules likely allow what you want to do, with citations from official U.S. government sources.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-accent={DEFAULT_ACCENT}
      data-mode="system"
      data-theme="light"
      suppressHydrationWarning
      className={`${nunito.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <InlineScript html={THEME_INIT_SCRIPT} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

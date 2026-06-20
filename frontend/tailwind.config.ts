import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ── legacy MLX3 (dark) tokens — kept so the original pages still render ──
        bg: "#0a0a0f",
        panel: "#13131c",
        panel2: "#1b1b27",
        edge: "#2a2a3a",
        brand: "#836EF9",
        brand2: "#a594ff",
        ok: "#34d399",
        warn: "#fbbf24",
        bad: "#f87171",
        muted: "#8b8b9e",

        // ── Console brand kit (light, editorial fintech) ──
        paper: "#FAF8F5",
        ink: "#16130F",
        "ink-soft": "#5C554C",
        "ink-faint": "#938A7D",
        line: "#E7E1D8",
        "line-strong": "#D9D2C6",
        terracotta: {
          DEFAULT: "#C75432",
          dark: "#A8401F",
          soft: "#F5E4DC",
        },
        teal: {
          DEFAULT: "#2F6F6A",
          dark: "#235450",
          soft: "#DCEBE9",
        },
        // status palette
        "st-pending": "#8A8175",
        "st-pending-soft": "#EFEAE1",
        "st-failed": "#B23A2E",
        "st-failed-soft": "#F6E1DD",
      },
      fontFamily: {
        // Space Grotesk (headings) + JetBrains Mono (hashes) are wired via next/font
        // in the console layout (Step 2); these vars fall back gracefully until then.
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: {
        card: "12px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(22,19,15,0.04), 0 1px 3px rgba(22,19,15,0.05)",
        "card-hover": "0 6px 16px rgba(22,19,15,0.08)",
        pop: "0 12px 34px rgba(22,19,15,0.14)",
      },
    },
  },
  plugins: [],
};

export default config;

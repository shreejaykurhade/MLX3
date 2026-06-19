import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0a0a0f",
        panel: "#13131c",
        panel2: "#1b1b27",
        edge: "#2a2a3a",
        brand: "#836EF9", // Monad purple
        brand2: "#a594ff",
        ok: "#34d399",
        warn: "#fbbf24",
        bad: "#f87171",
        muted: "#8b8b9e",
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;

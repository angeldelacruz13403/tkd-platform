import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#080c14",
        foreground: "#f8fafc",
        card: "#0f172a",
        "card-hover": "#172033",
        sidebar: "#06090f",
        tkd: {
          chong: {
            DEFAULT: "#0ea5e9", // Blue side (World Taekwondo Chong)
            dark: "#0284c7",
            light: "#38bdf8",
            glow: "rgba(14, 165, 233, 0.25)",
          },
          hong: {
            DEFAULT: "#ef4444", // Red side (World Taekwondo Hong)
            dark: "#dc2626",
            light: "#f87171",
            glow: "rgba(239, 68, 68, 0.25)",
          },
          gold: "#f59e0b",
          emerald: "#10b981",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-outfit)", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
      },
      boxShadow: {
        "chong-glow": "0 0 25px -5px rgba(14, 165, 233, 0.4)",
        "hong-glow": "0 0 25px -5px rgba(239, 68, 68, 0.4)",
        "glass": "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
      },
    },
  },
  plugins: [],
};
export default config;

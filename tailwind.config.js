/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{ts,tsx}",
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Direction B design tokens ──
        // Terminal navy — the one dark token, used for hero + primary actions
        navy: {
          DEFAULT: "#0e1426",
          50: "#f4f5f9",
          800: "#141c36",
          900: "#0e1426",
          950: "#0b0f1e",
        },
        // Accent — indigo
        accent: {
          DEFAULT: "#4f46e5",
          soft: "#818cf8",
          50: "#eef2ff",
          100: "#e0e7ff",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
        },
        // Signal palette — ONLY for data (health bands)
        signal: {
          healthy: "#059669", // emerald-600
          "healthy-bright": "#34d399",
          caution: "#d97706", // amber-600
          "caution-bright": "#fbbf24",
          risk: "#e11d48", // rose-600
          "risk-bright": "#fb7185",
        },
      },
      fontFamily: {
        // Inter is the single display + body face
        display: ["Inter", "system-ui", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        // Data: JetBrains Mono (scores, metric figures)
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      fontSize: {
        // Strict type scale — nothing below 11px
        "2xs": ["0.6875rem", { lineHeight: "1rem" }], // 11px
      },
      borderRadius: {
        // Single radius token system
        card: "1rem", // 16px — cards
        control: "0.75rem", // 12px — buttons, inputs
      },
      boxShadow: {
        // One shadow recipe for cards, one for lifted/hover
        card: "0 1px 3px 0 rgb(15 23 42 / 0.04), 0 1px 2px -1px rgb(15 23 42 / 0.04)",
        lift: "0 20px 40px -20px rgb(79 70 229 / 0.25)",
        hero: "0 24px 54px -16px rgb(0 0 0 / 0.5)",
      },
      keyframes: {
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
      },
      animation: {
        "pulse-soft": "pulseSoft 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

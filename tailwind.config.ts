import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#0F172A",
        accent: "#3B82F6",
        success: "#10B981",
        danger: "#EF4444",
        warning: "#F59E0B",
        surface: "#F8FAFC",
        "text-primary": "#1E293B",
        "text-secondary": "#64748B",
      },
    },
  },
  plugins: [],
};

export default config;

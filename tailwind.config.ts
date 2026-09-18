import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        stallion: {
          DEFAULT: "#0f172a",
          accent: "#4f46e5",
        },
      },
    },
  },
  plugins: [],
};

export default config;

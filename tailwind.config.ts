import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        parchment: {
          50: "#fdf8f0",
          100: "#f9edda",
          200: "#f2d8b0",
          300: "#e9bd7c",
          400: "#df9e4b",
          500: "#d4862c",
          600: "#b96d22",
          700: "#99541f",
          800: "#7c431f",
          900: "#65381d",
        },
        midnight: {
          50: "#f0f1f6",
          100: "#d9dce8",
          200: "#bcc1d5",
          300: "#99a0bc",
          400: "#777fa1",
          500: "#5e6589",
          600: "#4a5074",
          700: "#3d425f",
          800: "#2a2d42",
          900: "#1a1c2e",
        },
      },
      fontFamily: {
        fantasy: ["Cinzel", "serif"],
        body: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;

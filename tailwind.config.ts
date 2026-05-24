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
          950: "#111322",
        },
        amber: {
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
          700: "#b45309",
          800: "#92400e",
          900: "#78350f",
        },
      },
      fontFamily: {
        fantasy: ["Cinzel", "serif"],
        body: ["Inter", "sans-serif"],
      },
      boxShadow: {
        'glow-amber': '0 0 20px -5px rgba(245, 158, 11, 0.3), 0 0 40px -10px rgba(245, 158, 11, 0.15)',
        'glow-amber-sm': '0 0 10px -3px rgba(245, 158, 11, 0.25)',
        'glow-amber-lg': '0 0 40px -5px rgba(245, 158, 11, 0.4), 0 0 80px -15px rgba(245, 158, 11, 0.2)',
        'inner-glow': 'inset 0 1px 0 0 rgba(255,255,255,0.05)',
        'card': '0 4px 24px -8px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(255, 255, 255, 0.03)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E\")",
        'star-pattern': 'radial-gradient(1px 1px at 20px 30px, rgba(255,255,255,0.15), transparent), radial-gradient(1px 1px at 40px 70px, rgba(255,255,255,0.1), transparent), radial-gradient(1px 1px at 50px 160px, rgba(255,255,255,0.12), transparent), radial-gradient(1px 1px at 90px 40px, rgba(255,255,255,0.08), transparent), radial-gradient(1px 1px at 130px 80px, rgba(255,255,255,0.1), transparent)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'fade-in-up': 'fadeInUp 0.5s ease-out forwards',
        'fade-in-down': 'fadeInDown 0.4s ease-out forwards',
        'slide-in-left': 'slideInLeft 0.4s ease-out forwards',
        'slide-in-right': 'slideInRight 0.4s ease-out forwards',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'scale-in': 'scaleIn 0.3s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px -5px rgba(245, 158, 11, 0.3)' },
          '50%': { boxShadow: '0 0 30px -3px rgba(245, 158, 11, 0.5)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
};
export default config;

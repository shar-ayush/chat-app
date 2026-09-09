/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#007AFF",
          light: "#3395FF",
          dark: "#0055B3",
          soft: "#E5F2FF",
        },
        surface: {
          DEFAULT: "#1C1C1E",
          light: "#2C2C2E",
          dark: "#0D0D0F",
          card: "#1C1C1E",
          elevated: "#2C2C2E",
        },
        foreground: "#FFFFFF",
        "muted-foreground": "#8E8E93",
        "subtle-foreground": "#636366",
        incoming: {
          DEFAULT: "#E9E9EB",
          dark: "#262628",
        },
      },
    },
  },
  plugins: [],
};

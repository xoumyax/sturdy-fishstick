/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: "#FCA47C",
          yellow: "#F9D779",
          teal:   "#23CED9",
          sage:   "#A1CCA6",
          dark:   "#097C87",
          coral:  "#FF7F6B",
          mint:   "#B8EDD6",
          jade:   "#1A8C72",
          peach:  "#FFB89A",
        },
      },
      backgroundImage: {
        "sunrise": "linear-gradient(135deg, #FCA47C 0%, #F9D779 100%)",
        "jade":    "linear-gradient(135deg, #097C87 0%, #1A8C72 100%)",
        "teal":    "linear-gradient(135deg, #23CED9 0%, #097C87 100%)",
        "sage":    "linear-gradient(135deg, #A1CCA6 0%, #1A8C72 100%)",
      },
    },
  },
  plugins: [],
}

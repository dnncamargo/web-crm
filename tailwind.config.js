/** @type {import('tailwindcss').Config} */

module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}", // Se você tiver uma pasta 'src'
    "./app/styles/**/*.css", // Inclui seus arquivos CSS personalizados
  ],
  theme: {
    extend: {},
  },

  plugins: [],
}
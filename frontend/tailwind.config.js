/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // CRITICAL: This tells Tailwind where your classes are
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

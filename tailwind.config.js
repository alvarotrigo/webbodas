/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./all.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./sections/**/*.html",
    "./templates/html/**/*.html",
    "./app.php",
    "./admin.php",
    "./public/js/**/*.js"
  ],
  theme: {
    extend: {},
  },
  plugins: [
    require('@tailwindcss/container-queries'),
  ],
} 
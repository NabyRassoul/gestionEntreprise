/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'salesforce-blue': '#0176D3',
        'salesforce-dark-blue': '#014486',
        'salesforce-light-blue': '#E8F3FA',
        'salesforce-success': '#04844B',
        'salesforce-warning': '#FFB75D',
        'salesforce-error': '#C23934',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'salesforce': '0 2px 4px 0 rgba(0,0,0,0.07)',
        'salesforce-lg': '0 4px 8px 0 rgba(0,0,0,0.1)',
      }
    },
  },
  plugins: [],
}
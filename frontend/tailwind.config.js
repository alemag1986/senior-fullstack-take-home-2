/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        mono: [
          '"JetBrains Mono"',
          '"iA Writer Mono"',
          '"SF Mono"',
          '"Fira Code"',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
      colors: {
        sepia: {
          50: '#FDFCF7',
          100: '#F7F4EB',
          200: '#EBE5D5',
          300: '#D5CDB7',
          800: '#4A4639',
          900: '#2D2B28',
        },
      },
    },
  },
  plugins: [],
};

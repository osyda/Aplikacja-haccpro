import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#1B2E4B',
          green: '#2ECC71',
          'navy-light': '#243B5C',
          'navy-dark': '#152338',
          'green-dark': '#27AE60',
        },
      },
    },
  },
  plugins: [],
}
export default config

import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/styles/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: '#20166E',
        red: '#E41E2B',
        ink: '#17161D',
        muted: '#8B8A98',
        hairline: '#ECECF1',
        fill: '#F5F5F8',
        'page-bg': '#E9E8EE',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      keyframes: {
        breathe: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.06)' },
        },
        'favorite-pop': {
          '0%': { transform: 'scale(0.8)' },
          '45%': { transform: 'scale(1.35)' },
          '75%': { transform: 'scale(0.92)' },
          '100%': { transform: 'scale(1)' },
        },
        'favorite-shrink': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(0.6)' },
        },
        'favorite-card-leave': {
          to: { opacity: '0', transform: 'scale(0.85)' },
        },
      },
      animation: {
        breathe: 'breathe 2.4s ease-in-out infinite',
        'favorite-pop': 'favorite-pop 320ms ease-out',
        'favorite-shrink': 'favorite-shrink 240ms ease-in-out',
        'favorite-card-leave': 'favorite-card-leave 200ms ease-in forwards',
      },
    },
  },
  plugins: [],
};
export default config;

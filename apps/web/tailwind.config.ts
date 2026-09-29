import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: { extend: { colors: { mission: { bg: 'var(--bg)', panel: 'var(--panel)', fg: 'var(--fg)', muted: 'var(--muted)', line: 'var(--line)', mars: 'var(--mars)', earth: 'var(--earth)' } }, borderRadius: { none: '0', sm: '0', DEFAULT: '0', md: '0', lg: '0', xl: '0', '2xl': '0', '3xl': '0', full: '0' } } },
  plugins: [],
} satisfies Config;

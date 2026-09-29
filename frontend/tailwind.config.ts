import type { Config } from 'tailwindcss'

const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        display: ['"Space Grotesk"', 'Inter', 'sans-serif'],
      },
      colors: {
        bg: token('bg'),
        surface: token('surface'),
        raised: token('raised'),
        line: token('border'),
        fg: token('text'),
        muted: token('muted'),
        dim: token('dim'),
        btc: token('btc'),
        'btc-deep': token('btc-deep'),
        stx: token('stx'),
        good: token('green'),
        warn: token('amber'),
        info: token('blue'),
        bad: token('red'),
      },
    },
  },
  plugins: [],
}

export default config

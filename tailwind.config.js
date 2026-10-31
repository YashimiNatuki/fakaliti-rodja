const c = (v) => `rgb(var(--${v}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: c('void'),
        surface: c('surface'),
        raised: c('raised'),
        line: c('line'),
        cy: c('cy'),
        mg: c('mg'),
        amber: c('amber'),
        red: c('red'),
        text: c('text'),
        dim: c('dim')
      },
      fontFamily: {
        mono: ['"JetBrains Mono Variable"', '"JetBrains Mono"', 'Consolas', 'ui-monospace', 'monospace']
      }
    }
  },
  plugins: []
};

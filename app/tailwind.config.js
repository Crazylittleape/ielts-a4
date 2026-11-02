/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: 'var(--color-paper)',
        paper: {
          DEFAULT: 'var(--color-paper)',
          2: 'var(--color-paper-2)',
          3: 'var(--color-paper-3)'
        },
        sheet: {
          DEFAULT: 'var(--color-sheet)',
          2: 'var(--color-sheet-2)'
        },
        ink: {
          DEFAULT: 'var(--color-ink)',
          2: 'var(--color-ink-2)',
          soft: 'var(--color-muted)',
          faint: 'var(--color-muted)'
        },
        rule: {
          DEFAULT: 'var(--color-rule)',
          2: 'var(--color-rule-2)'
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          ink: 'var(--color-accent-ink)',
          soft: 'var(--color-accent-soft)',
          rule: 'var(--color-accent-rule)'
        },
        error: {
          DEFAULT: 'var(--color-error)',
          ink: 'var(--color-error-ink)',
          soft: 'var(--color-error-soft)',
          rule: 'var(--color-error-rule)'
        },
        success: {
          DEFAULT: 'var(--color-success)',
          ink: 'var(--color-success-ink)',
          soft: 'var(--color-success-soft)',
          rule: 'var(--color-success-rule)'
        },
        warn: {
          DEFAULT: 'var(--color-warn)',
          ink: 'var(--color-warn-ink)',
          soft: 'var(--color-warn-soft)',
          rule: 'var(--color-warn-rule)'
        },
        highlight: 'var(--color-highlight)',
        scrim: 'var(--color-scrim)',
        veil: 'var(--color-veil)',
        rose: {
          50: 'var(--color-error-soft)',
          100: 'var(--color-error-soft)',
          200: 'var(--color-error-rule)',
          300: 'var(--color-error-rule)',
          400: 'var(--color-error)',
          500: 'var(--color-error)',
          600: 'var(--color-error)',
          700: 'var(--color-error)'
        },
        lilac: {
          50: 'var(--color-paper-2)',
          100: 'var(--color-paper-3)',
          200: 'var(--color-rule)',
          300: 'var(--color-rule-2)',
          400: 'var(--color-muted)',
          500: 'var(--color-ink-2)'
        },
        sage: {
          50: 'var(--color-success-soft)',
          100: 'var(--color-success-soft)',
          200: 'var(--color-success-rule)',
          300: 'var(--color-success-rule)',
          400: 'var(--color-success)',
          500: 'var(--color-success)',
          600: 'var(--color-success)',
          700: 'var(--color-success)'
        },
        honey: {
          50: 'var(--color-warn-soft)',
          100: 'var(--color-warn-soft)',
          200: 'var(--color-warn-rule)',
          300: 'var(--color-warn-rule)',
          500: 'var(--color-warn)',
          600: 'var(--color-warn)',
          700: 'var(--color-warn)'
        },
        blush: 'var(--color-rule)'
      },
      fontFamily: {
        ui: ['var(--font-body)'],
        body: ['var(--font-body)'],
        serif: ['var(--font-display)'],
        display: ['var(--font-display)'],
        mono: ['var(--font-outlier)'],
        outlier: ['var(--font-outlier)']
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        paper: 'var(--shadow-sheet)',
        button: 'var(--shadow-button)',
        sheet: 'var(--shadow-modal)'
      }
    }
  },
  plugins: []
};

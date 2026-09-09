import type { Config } from 'tailwindcss';

/**
 * Mirrors the main app's token names deliberately.
 *
 * The console is a different product with a denser layout, but a `surface` or
 * a `brand` has to mean the same thing in both — otherwise a component copied
 * across renders wrong in a way that is hard to spot. Values live in
 * app/globals.css as CSS variables, same as the main app.
 */
const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: 'var(--brand)',
          hover: 'var(--brand-hover)',
          muted: 'var(--brand-muted)',
          fg: 'var(--brand-fg)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          muted: 'var(--accent-muted)',
        },
        canvas: 'var(--canvas)',
        surface: {
          DEFAULT: 'var(--surface)',
          raised: 'var(--surface-raised)',
          sunken: 'var(--surface-sunken)',
        },
        ink: {
          DEFAULT: 'var(--ink)',
          muted: 'var(--ink-muted)',
          subtle: 'var(--ink-subtle)',
        },
        line: {
          DEFAULT: 'var(--line)',
          strong: 'var(--line-strong)',
        },
        danger: 'var(--danger)',
        'danger-muted': 'var(--danger-muted)',
        warning: 'var(--warning)',
        'warning-muted': 'var(--warning-muted)',
      },
      fontFamily: {
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      /**
       * Tighter than the main app's 20px default.
       *
       * That radius is tuned for a phone-sized card with one thing on it. The
       * console is dense tables and small controls, where the same curve eats
       * the corner of every cell and makes rows read as separated tiles.
       */
      borderRadius: {
        DEFAULT: '10px',
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
      transitionDuration: {
        snap: '150ms',
      },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.6s infinite',
        'fade-in': 'fade-in 180ms cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};

export default config;

import type { Config } from 'tailwindcss';

/**
 * Design tokens live here and in app/globals.css as CSS variables.
 * Never inline hex values in components — always reference these token names.
 */
const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './content/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand
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
        // Surfaces
        canvas: 'var(--canvas)',
        surface: {
          DEFAULT: 'var(--surface)',
          raised: 'var(--surface-raised)',
          sunken: 'var(--surface-sunken)',
        },
        // Text
        ink: {
          DEFAULT: 'var(--ink)',
          muted: 'var(--ink-muted)',
          subtle: 'var(--ink-subtle)',
        },
        line: {
          DEFAULT: 'var(--line)',
          strong: 'var(--line-strong)',
        },
        /**
         * `muted` is the tinted fill. Reach for it instead of writing
         * `bg-danger/10` — opacity modifiers do not compile on these tokens,
         * because they are whole colour values rather than the channel
         * triplets an `<alpha-value>` config needs. See app/globals.css.
         */
        danger: {
          DEFAULT: 'var(--danger)',
          muted: 'var(--danger-muted)',
        },
        warning: {
          DEFAULT: 'var(--warning)',
          muted: 'var(--warning-muted)',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        // 20px is the default component radius per the design system.
        DEFAULT: '20px',
        sm: '10px',
        md: '14px',
        lg: '20px',
        xl: '28px',
        '2xl': '36px',
      },
      spacing: {
        // 24px base grid
        grid: '24px',
        'grid-half': '12px',
        'grid-2': '48px',
      },
      /**
       * Elevation. Each step pairs a tight contact shadow with a wide ambient
       * one — a single large blur reads as fog rather than lift, which is what
       * made cards look like they were printed on the page instead of sitting
       * above it.
       */
      boxShadow: {
        soft: '0 1px 2px rgba(16,24,20,0.05), 0 2px 8px -2px rgba(16,24,20,0.07)',
        raised:
          '0 1px 2px rgba(16,24,20,0.06), 0 4px 12px -2px rgba(16,24,20,0.09), 0 16px 32px -16px rgba(16,24,20,0.18)',
        float:
          '0 2px 6px -1px rgba(16,24,20,0.1), 0 12px 28px -8px rgba(16,24,20,0.18), 0 32px 64px -24px rgba(16,24,20,0.28)',
        glow: '0 0 0 1px var(--brand-muted), 0 8px 32px -8px var(--brand-muted)',
      },
      backdropBlur: {
        glass: '20px',
      },
      transitionDuration: {
        // Motion should feel snappy: 150–250ms.
        snap: '180ms',
        sheet: '240ms',
      },
      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'marker-in': {
          '0%': { opacity: '0', transform: 'translateY(8px) scale(0.9)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.8)', opacity: '0.7' },
          '100%': { transform: 'scale(2.2)', opacity: '0' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.6s infinite',
        'marker-in': 'marker-in 220ms cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-ring': 'pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};

export default config;

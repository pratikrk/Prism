import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        /* Prism semantic colors — reference CSS vars directly */
        prism: {
          bg:          'var(--bg)',
          elev:        'var(--bg-elev)',
          card:        'var(--bg-card)',
          hover:       'var(--bg-hover)',
          border:      'var(--border)',
          'border-strong': 'var(--border-strong)',
          text:        'var(--text)',
          mut:         'var(--text-mut)',
          dim:         'var(--text-dim)',
          accent:      'var(--accent)',
          ok:          'var(--ok)',
          warn:        'var(--warn)',
          err:         'var(--err)',
          running:     'var(--running)',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
};

export default config;

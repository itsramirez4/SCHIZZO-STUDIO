/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // References to CSS custom properties (defined in variables.css), not literal hex —
        // this is what lets the workspace theme toggle recolor the whole app at runtime
        // without touching every component's className.
        bg: 'var(--color-bg)',
        panel: 'var(--color-panel)',
        panelLight: 'var(--color-panel-light)',
        border: 'var(--color-border)',
        accent: 'var(--color-accent)',
        accentSoft: 'var(--color-accent-soft)',
        textDim: 'var(--color-text-dim)',
        // Full-contrast readable text — was hardcoded to Tailwind's built-in `white`
        // everywhere (fine when dark is the only theme), but that reads as invisible
        // white-on-white once a light theme exists. `bg-accent text-white` combos are
        // intentionally left as literal white (correct against the fixed blue accent
        // in both themes); every other former `text-white`/`hover:text-white` became
        // `text-text`/`hover:text-text` so it inverts correctly with the theme.
        text: 'var(--color-text)',
      },
    },
  },
  plugins: [],
};

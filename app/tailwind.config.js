/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#F3EFE6',
        paper: '#FAF7F0',
        ink: { DEFAULT: '#181715', soft: '#524E46', faint: '#6E695F' },
        rose: { 50: '#F7EFEA', 100: '#EFE1D9', 200: '#DFC3B5', 300: '#C89B87', 400: '#B25844', 500: '#9A3424', 600: '#82281A', 700: '#691E13' },
        lilac: { 50: '#F1EFEA', 100: '#E5E1D8', 200: '#CFC9BC', 300: '#ABA393', 400: '#6E6A61', 500: '#46443F' },
        sage: { 50: '#ECF3EF', 100: '#D8E7DF', 200: '#B4D0C2', 300: '#7FA996', 400: '#3D7A63', 500: '#215E49', 600: '#174736', 700: '#113629' },
        honey: { 50: '#F9F3E6', 100: '#F1E4C8', 200: '#E3CA96', 300: '#CFA85B', 500: '#8F6214', 600: '#764F0E', 700: '#5E3E09' },
        blush: '#D6CFC1'
      },
      fontFamily: {
        ui: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"Helvetica Neue"', '"PingFang SC"', '"Hiragino Sans GB"', '"Microsoft YaHei"', 'sans-serif'],
        serif: ['"Iowan Old Style"', '"Palatino Linotype"', 'Palatino', '"Baskerville"', 'Georgia', '"Songti SC"', '"STSong"', 'serif'],
        mono: ['"SF Mono"', 'ui-monospace', 'Menlo', 'Consolas', 'monospace']
      },
      boxShadow: {
        card: '0 1px 2px rgba(24, 23, 21, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.7)',
        paper: '0 1px 2px rgba(28, 25, 20, 0.06), 0 10px 28px -8px rgba(28, 25, 20, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.85)',
        button: '0 1px 1px rgba(24, 23, 21, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
        sheet: '0 -12px 32px rgba(24, 23, 21, 0.14)'
      }
    }
  },
  plugins: []
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FAF7F0',
        paper: '#FCFAF6',
        ink: { DEFAULT: '#1A1D29', soft: '#55596E', faint: '#878B9E' },
        rose: { 50: '#F0F3F9', 100: '#E2E8F4', 200: '#C6D3E8', 300: '#9FB3D6', 400: '#6B89BF', 500: '#3B5B99', 600: '#284378', 700: '#1D3360' },
        lilac: { 50: '#F5F1FC', 100: '#EBE3F8', 200: '#D6C6F0', 300: '#B9A0E3', 400: '#9A78D3', 500: '#7B55BE' },
        sage: { 50: '#F0F7F4', 100: '#DEF0E9', 200: '#B8DFD1', 300: '#86C5B2', 400: '#4B9D87', 500: '#287A66', 600: '#1D5E4E' },
        honey: { 50: '#FDF9EE', 100: '#FAF1D6', 200: '#F5E2A8', 300: '#ECCB6E', 500: '#B88220', 600: '#946513', 700: '#754E0C' },
        blush: '#EAE5D8'
      },
      fontFamily: {
        ui: ['Calibri', 'Carlito', '-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"SF Pro Display"', 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'sans-serif'],
        serif: ['"Newsreader"', 'Georgia', 'Cambria', '"Times New Roman"', 'Times', '"Liberation Serif"', '"PingFang SC"', 'serif']
      },
      boxShadow: {
        card: '0 1px 3px rgba(26, 29, 41, 0.04), 0 4px 14px rgba(26, 29, 41, 0.05)',
        paper: '0 1px 3px rgba(45, 38, 25, 0.06), 0 6px 18px -3px rgba(45, 38, 25, 0.08), 0 18px 36px -8px rgba(45, 38, 25, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.95)',
        button: '0 1px 2px rgba(0, 0, 0, 0.08)',
        sheet: '0 -8px 24px rgba(26, 29, 41, 0.12)'
      }
    }
  },
  plugins: []
};

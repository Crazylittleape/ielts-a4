/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FAF6EF',
        paper: '#FFFDF8',
        ink: { DEFAULT: '#272A3D', soft: '#5D6075', faint: '#676A7F' },
        rose: { 50: '#EEF0FB', 100: '#DEE2F7', 200: '#BCC4EE', 300: '#949FE0', 400: '#6E79CF', 500: '#4F55B8', 600: '#3D4199' },
        lilac: { 50: '#F5F1FC', 100: '#EBE3F8', 200: '#D6C6F0', 300: '#B9A0E3', 400: '#9A78D3', 500: '#7B55BE' },
        sage: { 50: '#ECF7F5', 100: '#D3EEE9', 200: '#A8DCD3', 300: '#74C3B6', 400: '#2F9C8A', 500: '#1F7A6C' },
        honey: { 50: '#FDF7E8', 100: '#FBEDCB', 300: '#F2C66B', 500: '#B7791F', 600: '#97611A', 700: '#7A4E16' },
        blush: '#EFE8DC'
      },
      fontFamily: {
        ui: ['Calibri', 'Carlito', '-apple-system', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'sans-serif'],
        serif: ['"Times New Roman"', 'Times', '"Liberation Serif"', '"PingFang SC"', '"Hiragino Sans GB"', '"Microsoft YaHei"', 'sans-serif']
      },
      boxShadow: {
        card: '0 1px 2px rgba(39, 42, 61, 0.06), 0 4px 16px rgba(39, 42, 61, 0.06)',
        paper: '0 10px 30px rgba(39, 42, 61, 0.12), 0 1px 3px rgba(39, 42, 61, 0.06)',
        sheet: '0 -8px 30px rgba(39, 42, 61, 0.15)'
      }
    }
  },
  plugins: []
};

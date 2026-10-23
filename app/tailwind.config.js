/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FBF7F4',
        paper: '#FFFCFA',
        ink: { DEFAULT: '#4A3F47', soft: '#8A7A86', faint: '#B8AAB4' },
        rose: { 50: '#FDF2F5', 100: '#FAE3EA', 200: '#F4C6D3', 300: '#EBA4B8', 400: '#DF8AA3', 500: '#CF6F8C', 600: '#B45673' },
        lilac: { 50: '#F6F2FB', 100: '#ECE4F7', 200: '#D8C9EE', 300: '#BFA8E0', 400: '#A88CD0', 500: '#8F72BC' },
        sage: { 50: '#F1F7F3', 100: '#DFEDE4', 200: '#BFDBC9', 300: '#98C3A8', 400: '#79AC8D', 500: '#5F9474' },
        honey: { 100: '#FBEFD9', 300: '#F2CF8E', 500: '#D9A74A' },
        blush: '#F7E6EA'
      },
      fontFamily: {
        ui: ['Calibri', 'Carlito', '-apple-system', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'sans-serif'],
        serif: ['"Times New Roman"', 'Times', '"Liberation Serif"', '"PingFang SC"', '"Hiragino Sans GB"', '"Microsoft YaHei"', 'sans-serif']
      },
      boxShadow: {
        card: '0 2px 14px rgba(122, 86, 104, 0.08)',
        paper: '0 10px 30px rgba(122, 86, 104, 0.12), 0 1px 3px rgba(122, 86, 104, 0.06)',
        sheet: '0 -8px 30px rgba(122, 86, 104, 0.15)'
      }
    }
  },
  plugins: []
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    colors: {
      transparent: 'transparent',
      red: '#D91E2A',
      'red-soft': '#FEF2F2',
      white: '#FFFFFF',
      surface: '#F7F7F8',
      border: '#E4E4E7',
      black: '#09090B',
      muted: '#71717A',
    },
    extend: {
      fontFamily: {
        sans: ['PlusJakartaSans_400Regular'],
        medium: ['PlusJakartaSans_500Medium'],
        semibold: ['PlusJakartaSans_600SemiBold'],
        bold: ['PlusJakartaSans_700Bold'],
        extrabold: ['PlusJakartaSans_800ExtraBold'],
      },
      borderRadius: {
        hero: '24px',
        calendar: '22px',
        card: '20px',
        control: '14px',
        chip: '10px',
        thumb: '12px',
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    colors: {
      transparent: 'transparent',
      red: '#D91E2A',
      white: '#FFFFFF',
      black: '#09090B',
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
        hero: '26px',
        calendar: '24px',
        card: '22px',
        control: '16px',
        chip: '12px',
      },
    },
  },
  plugins: [],
};

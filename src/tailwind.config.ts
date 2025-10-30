import type { Config } from 'tailwindcss';

let tailwindForms: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  tailwindForms = require('@tailwindcss/forms');
} catch {
  tailwindForms = () => {};
}

export default {
  darkMode: 'selector',
  content: [],
  theme: {
    screens: {
      xxs: '450px',
      xs: '576px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
  },
  plugins: [tailwindForms],
} satisfies Config;
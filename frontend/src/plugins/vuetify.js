import 'vuetify/styles';
import '@mdi/font/css/materialdesignicons.css';
import { createVuetify } from 'vuetify';

const saved = localStorage.getItem('mapping-theme');

export default createVuetify({
  icons: { defaultSet: 'mdi' },
  theme: {
    defaultTheme: saved === 'light' || saved === 'dark' ? saved : 'dark',
    themes: {
      dark: { colors: { primary: '#4772b3' } },
      light: { colors: { primary: '#3d6bb3' } },
    },
  },
});

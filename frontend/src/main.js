import { createApp } from 'vue';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/controls/dist/style.css';
import '@vue-flow/node-resizer/dist/style.css';
import './styles/mapping.css';
import App from './App.vue';
import vuetify from './plugins/vuetify';
import router from './router';

createApp(App).use(vuetify).use(router).mount('#app');

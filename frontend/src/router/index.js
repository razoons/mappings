import { createRouter, createWebHistory } from 'vue-router';
import MappingEditor from '../views/MappingEditor.vue';

const routes = [
  { path: '/', component: MappingEditor },
  { path: '/noeuds', component: () => import('../views/NodesHelp.vue') },
];

export default createRouter({
  history: createWebHistory(),
  routes,
});

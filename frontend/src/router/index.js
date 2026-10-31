import { createRouter, createWebHistory } from 'vue-router';
import Home from '../views/Home.vue';
import Inventory from '../views/Inventory.vue';

const routes = [
  { path: '/', component: Home },
  { path: '/inventory', component: Inventory },
];

export default createRouter({
  history: createWebHistory(),
  routes,
});

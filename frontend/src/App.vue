<template>
  <v-app>
    <v-navigation-drawer v-model="drawer" temporary>
      <v-list-item
        title="Mon App"
        subtitle="Gestion d'inventaire"
        prepend-icon="mdi-warehouse"
        nav
      />
      <v-divider />
      <v-list density="compact" nav>
        <v-list-item
          v-for="item in navItems"
          :key="item.to"
          :prepend-icon="item.icon"
          :title="item.title"
          :to="item.to"
          rounded="lg"
        />
      </v-list>
    </v-navigation-drawer>

    <v-app-bar color="primary" flat>
      <v-app-bar-nav-icon @click="drawer = !drawer" />
      <v-app-bar-title>{{ currentTitle }}</v-app-bar-title>
    </v-app-bar>

    <v-main>
      <router-view />
    </v-main>
  </v-app>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';

const drawer = ref(false);
const route = useRoute();

const navItems = [
  { title: 'Accueil', icon: 'mdi-home', to: '/' },
  { title: 'Inventaire', icon: 'mdi-package-variant', to: '/inventory' },
];

const currentTitle = computed(
  () => navItems.find((i) => i.to === route.path)?.title ?? 'Mon App'
);
</script>

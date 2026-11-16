<template>
  <v-app>
    <router-view />
    <AppDialogs />
  </v-app>
</template>

<script setup>
import AppDialogs from './components/AppDialogs.vue';
</script>

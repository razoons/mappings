<template>
  <svg viewBox="0 0 12 14" width="11" height="13" aria-hidden="true">
    <path
      :d="locked ? 'M3.5 6V4.2a2.5 2.5 0 0 1 5 0V6' : 'M3.5 6V4.2a2.5 2.5 0 0 1 4.9-.7'"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
    />
    <rect x="1.75" y="6" width="8.5" height="6.5" rx="1.3" fill="currentColor" />
  </svg>
</template>

<script setup>
defineProps({ locked: Boolean });
</script>

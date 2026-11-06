<template>
  <v-btn
    class="text-none font-weight-bold"
    variant="text"
    min-width="44"
    :title="t('Passer l’interface en anglais', 'Switch the interface to French')"
    @click="setLang(lang === 'fr' ? 'en' : 'fr')"
  >
    <!-- Drapeaux dessinés : les émojis drapeaux ne s'affichent pas sous Windows. -->
    <svg v-if="lang === 'fr'" class="flag" viewBox="0 0 60 30" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <clipPath id="flag-uk-clip"><path d="M30 15h30v15zv15H0zH0V0zV0h30z" /></clipPath>
      <path d="M0 0v30h60V0z" fill="#012169" />
      <path d="M0 0l60 30m0-30L0 30" stroke="#fff" stroke-width="6" />
      <path d="M0 0l60 30m0-30L0 30" clip-path="url(#flag-uk-clip)" stroke="#C8102E" stroke-width="4" />
      <path d="M30 0v30M0 15h60" stroke="#fff" stroke-width="10" />
      <path d="M30 0v30M0 15h60" stroke="#C8102E" stroke-width="6" />
    </svg>
    <svg v-else class="flag" viewBox="0 0 3 2" aria-hidden="true">
      <path d="M0 0h1v2H0z" fill="#002395" />
      <path d="M1 0h1v2H1z" fill="#fff" />
      <path d="M2 0h1v2H2z" fill="#ED2939" />
    </svg>
    <span class="ml-2">{{ lang === 'fr' ? 'EN' : 'FR' }}</span>
  </v-btn>
</template>

<script setup>
import { lang, setLang, t } from '../lib/i18n';

/** Bascule de langue de l'interface : affiche le drapeau et le code de la langue vers laquelle on passe. */
</script>

<style scoped>
.flag {
  width: 22px;
  height: 15px;
  border-radius: 2px;
  box-shadow: 0 0 0 1px rgba(128, 128, 128, 0.35);
}
</style>

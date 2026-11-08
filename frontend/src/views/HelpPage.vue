<template>
  <v-app-bar density="compact" flat border>
    <v-btn class="ml-2" prepend-icon="mdi-arrow-left" to="/">{{ t('Éditeur', 'Editor') }}</v-btn>
    <v-app-bar-title class="ml-4">{{ t('Aide', 'Help') }}</v-app-bar-title>
    <LangSwitch class="mr-2" />
  </v-app-bar>

  <v-main>
    <div class="help-page">
      <h1 class="text-h4 font-weight-bold mb-6">{{ t('Aide', 'Help') }}</h1>

      <h2 class="text-h5 font-weight-bold mb-2">{{ t('Me contacter', 'Contact me') }}</h2>
      <p class="mb-4">{{ t('J\'ai développé cet outil parce que j\'ai souvent été confronté dans mon travail à devoir analyser des interfaçages entre différentes applications.', 'I built this tool because my work has often required me to analyze interfaces between different applications.') }}</p>
      <p class="mb-4">{{ t('Et je n\'ai jamais trouvé d\'outil qui me permette de schématiser cette analyse de mapping, de le documenter, de vérifier les compatibilités et d\'avoir un visuel parlant.', 'And I never found a tool that let me diagram this mapping analysis, document it, check compatibility and get a clear visual overview.') }}</p>
      <p class="mb-4">{{ t('J\'ai donc décidé de le développer. Il n\'y a aucune ambition commerciale derrière donc il est en libre service. Si vous pensez à des idées pour l\'améliorer, ou si vous rencontrez des bugs, n\'hésitez pas à me contacter à cette adresse:', 'So I decided to build it myself. There is no commercial ambition behind it, so it is free for anyone to use. If you have ideas to improve it, or if you run into bugs, feel free to contact me at this address:') }}</p>
      <div class="d-flex align-center ga-2">
        <a :href="`mailto:${EMAIL}`">{{ EMAIL }}</a>
        <v-btn
          icon="mdi-content-copy"
          size="small"
          variant="text"
          :title="t('Copier l’adresse', 'Copy the address')"
          @click="copyAddress"
        />
      </div>

      <h2 class="text-h5 font-weight-bold mt-8 mb-2">{{ t('Navigateurs compatibles', 'Supported browsers') }}</h2>
      <p class="mb-4">{{ t('ScheMap fonctionne sur ordinateur, à partir de ces versions :', 'ScheMap works on desktop, starting from these versions:') }}</p>
      <v-table class="mb-4" density="compact">
        <thead>
          <tr>
            <th>{{ t('Navigateur', 'Browser') }}</th>
            <th>{{ t('Version minimale', 'Minimum version') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="b in BROWSERS" :key="b.name">
            <td>{{ b.name }}</td>
            <td>{{ b.version }}</td>
          </tr>
        </tbody>
      </v-table>
    </div>

    <v-snackbar v-model="snack.show" :color="snack.color" :timeout="1800">{{ snack.text }}</v-snackbar>
  </v-main>
</template>

<script setup>
import { reactive } from 'vue';
import LangSwitch from '../components/LangSwitch.vue';
import { t } from '../lib/i18n';

/** Page d'aide : l'adresse email (lien `mailto:` et bouton pour la copier) et les navigateurs compatibles. */
const EMAIL = 'toniosarazin@gmail.com';

// Premières versions qui gèrent ce dont l'application a besoin (color-mix, :has, CompressionStream 'deflate-raw', dvh…).
const BROWSERS = [
  { name: 'Chrome', version: '111' },
  { name: 'Edge', version: '111' },
  { name: 'Firefox', version: '121' },
  { name: 'Safari', version: '16.4' },
];

const snack = reactive({ show: false, text: '', color: 'success' });

async function copyAddress() {
  try {
    await navigator.clipboard.writeText(EMAIL);
    Object.assign(snack, { show: true, text: t('Adresse copiée', 'Address copied'), color: 'success' });
  } catch {
    Object.assign(snack, { show: true, text: t('Copie impossible', 'Could not copy'), color: 'error' });
  }
}
</script>

<style scoped>
.help-page {
  max-width: 640px;
  margin: 0 auto;
  padding: 32px 24px;
}
</style>

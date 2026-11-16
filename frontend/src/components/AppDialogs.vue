<template>
  <v-dialog :model-value="!!request" max-width="520" @update:model-value="!$event && cancel()">
    <v-card v-if="request">
      <v-card-title>{{ request.title }}</v-card-title>
      <v-card-text>
        <p v-if="request.text" class="text-body-2 mb-3">{{ request.text }}</p>
        <ul v-if="request.lines?.length" class="dialog-lines mb-3">
          <li v-for="l in request.lines" :key="l">{{ l }}</li>
        </ul>
        <v-text-field
          v-if="request.kind === 'text'"
          ref="input"
          v-model="value"
          :label="request.label"
          variant="outlined"
          density="comfortable"
          hide-details
          autofocus
          @keydown.enter.prevent="ok"
          @focus="$event.target.select()"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn @click="cancel">{{ t('Annuler', 'Cancel') }}</v-btn>
        <template v-if="request.kind === 'choice'">
          <v-btn
            v-for="(c, i) in request.choices"
            :key="c.value"
            :color="c.color ?? (i === request.choices.length - 1 ? 'primary' : undefined)"
            :variant="i === request.choices.length - 1 ? 'flat' : 'text'"
            @click="request.resolve(c.value)"
          >
            {{ c.label }}
          </v-btn>
        </template>
        <v-btn v-else :color="request.danger ? 'error' : 'primary'" variant="flat" :disabled="request.kind === 'text' && !value.trim()" @click="ok">
          {{ request.okLabel ?? t('OK', 'OK') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { t } from '../lib/i18n';
import { dialog } from '../services/dialogs';

/** Fenêtres de question de l'application (voir services/dialogs.js). */
const request = computed(() => dialog.current);
const value = ref('');

watch(request, (r) => r?.kind === 'text' && (value.value = r.initial ?? ''));

const ok = () => {
  if (request.value.kind === 'text' && !value.value.trim()) return;
  request.value.resolve(request.value.kind === 'text' ? value.value : true);
};
const cancel = () => request.value?.resolve(request.value.kind === 'confirm' ? false : null);
</script>

<style>
.dialog-lines {
  padding-left: 20px;
  font-size: 0.875rem;
  max-height: 200px;
  overflow-y: auto;
}
</style>

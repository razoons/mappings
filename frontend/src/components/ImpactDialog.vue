<template>
  <v-dialog :model-value="!!request" max-width="720" scrollable persistent>
    <v-card v-if="request">
      <v-card-title class="d-flex align-center ga-2">
        <v-icon icon="mdi-alert-outline" color="warning" />
        {{ request.title }}
      </v-card-title>
      <v-card-text>
        <p class="text-body-2 mb-3">{{ request.intro }}</p>

        <template v-if="changes.length">
          <div class="text-subtitle-2 mb-1">{{ t('Champs supprimés ou modifiés', 'Deleted or changed fields') }}</div>
          <ul class="impact-list mb-3">
            <li v-for="c in changes" :key="c.path">
              <code>{{ c.path }}</code> — <span :class="c.kind === 'removed' ? 'text-error' : 'text-warning'">{{ c.details.join(', ') }}</span>
            </li>
          </ul>
        </template>

        <div class="text-subtitle-2 mb-1">{{ count(request.flows.length, 'utilisation dans les flux', 'use in flows', 'utilisations dans les flux', 'uses in flows') }}</div>
        <v-table density="compact" class="impact-table">
          <thead>
            <tr>
              <th>{{ t('Flux', 'Flow') }}</th>
              <th>{{ t('Nœud', 'Node') }}</th>
              <th>{{ t('Champs reliés touchés', 'Linked fields affected') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(f, i) in request.flows" :key="i">
              <td>{{ f.flow }}</td>
              <td>{{ f.node }}</td>
              <td>
                <span v-if="f.diverged" class="text-medium-emphasis">{{ t('Modifié localement : ne sera pas mis à jour', 'Changed locally: will not be updated') }}</span>
                <template v-else-if="f.fields.length">
                  <div v-for="c in f.fields" :key="c.path" :class="c.kind === 'removed' ? 'text-error' : 'text-warning'">
                    <code>{{ c.path }}</code> — {{ c.details.join(', ') }}{{ c.kind === 'removed' ? t(' (ses liens seront retirés)', ' (its links will be removed)') : '' }}
                  </div>
                </template>
                <span v-else class="text-success">{{ t('Aucun', 'None') }}</span>
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-card-text>
      <v-card-actions class="flex-wrap">
        <v-btn @click="choose(null)">{{ t('Annuler', 'Cancel') }}</v-btn>
        <v-spacer />
        <v-btn v-if="request.allowSaveAs" variant="text" @click="choose('saveAs')">{{ t('Enregistrer sous un nouveau modèle', 'Save as a new model') }}</v-btn>
        <v-btn color="warning" variant="flat" @click="choose('apply')">{{ request.applyLabel }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { computed } from 'vue';
import { count, t } from '../lib/i18n';

/**
 * Avertissement avant de modifier un modèle utilisé par des flux : champs touchés et flux concernés.
 * `request` : `{ title, intro, changes: Map, flows, allowSaveAs, applyLabel, resolve }` ; le choix (`apply`,
 * `saveAs` ou `null`) est rendu par `resolve`.
 */
const props = defineProps({ request: { type: Object, default: null } });

const changes = computed(() => [...(props.request?.changes?.values() ?? [])]);

const choose = (value) => props.request.resolve(value);
</script>

<style>
.impact-list {
  padding-left: 20px;
  font-size: 0.875rem;
}
.impact-table td {
  vertical-align: top;
  padding-top: 4px !important;
  padding-bottom: 4px !important;
  font-size: 0.8125rem;
}
</style>

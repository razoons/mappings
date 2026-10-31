<template>
  <v-container max-width="700" class="py-6">
    <v-card rounded="lg" elevation="2" class="mb-6">
      <v-card-title class="pa-4">Ajouter un article</v-card-title>
      <v-card-text>
        <v-form @submit.prevent="addItem">
          <v-row>
            <v-col cols="12" sm="7">
              <v-text-field
                v-model="form.name"
                label="Nom de l'objet"
                required
                clearable
                hide-details
              />
            </v-col>
            <v-col cols="12" sm="3">
              <v-text-field
                v-model.number="form.quantity"
                label="Quantité"
                type="number"
                min="1"
                hide-details
              />
            </v-col>
            <v-col cols="12" sm="2" class="d-flex align-center">
              <v-btn type="submit" color="primary" block :loading="saving">
                Ajouter
              </v-btn>
            </v-col>
          </v-row>
        </v-form>
      </v-card-text>
    </v-card>

    <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-4" />

    <v-card v-if="!loading && items.length" rounded="lg" elevation="2">
      <v-list lines="two">
        <template v-for="(item, index) in items" :key="item.name">
          <v-list-item
            :title="item.name"
            :subtitle="`Quantité : ${item.quantity}`"
            prepend-icon="mdi-package-variant"
          />
          <v-divider v-if="index < items.length - 1" inset />
        </template>
      </v-list>
    </v-card>

    <v-alert v-else-if="!loading" type="info" variant="tonal" rounded="lg">
      Aucun article dans l'inventaire.
    </v-alert>
  </v-container>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const items = ref([]);
const form = ref({ name: '', quantity: 1 });
const loading = ref(false);
const saving = ref(false);

async function loadInventory() {
  loading.value = true;
  const res = await fetch('/api/inventory');
  items.value = await res.json();
  loading.value = false;
}

async function addItem() {
  saving.value = true;
  await fetch('/api/inventory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: form.value.name, quantity: form.value.quantity }),
  });
  form.value = { name: '', quantity: 1 };
  saving.value = false;
  await loadInventory();
}

onMounted(loadInventory);
</script>

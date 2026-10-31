<template>
  <v-container max-width="700" class="py-8">
    <v-row justify="center">
      <v-col cols="12" class="text-center">
        <v-icon size="80" color="primary">mdi-warehouse</v-icon>
        <h1 class="text-h4 font-weight-bold mt-4 mb-2">Bienvenue</h1>
        <p class="text-body-1 text-medium-emphasis mb-8">
          Gérez votre inventaire facilement depuis cette application.
        </p>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12" sm="6">
        <v-card rounded="lg" elevation="2" to="/inventory">
          <v-card-item>
            <template #prepend>
              <v-icon size="36" color="primary">mdi-package-variant</v-icon>
            </template>
            <v-card-title>Inventaire</v-card-title>
            <v-card-subtitle>Consulter et ajouter des articles</v-card-subtitle>
          </v-card-item>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const inventoryRoutes = require('./routes/inventory.routes');

const app = express();
const port = process.env.PORT || 8080;
const appName = process.env.APP_NAME || 'MyApp';
const apiSecretKey = process.env.API_SECRET_KEY;
const allowedOrigin = process.env.ALLOWED_ORIGIN;

app.use(cors({
  origin: allowedOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));
app.use(express.json());

app.use('/api/inventory', inventoryRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`[${appName}] Serveur prêt sur le port ${port}`);
  if (!apiSecretKey) {
    console.warn('⚠️  API_SECRET_KEY non définie — certaines fonctionnalités peuvent être désactivées.');
  }
});

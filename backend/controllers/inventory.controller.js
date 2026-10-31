const { listItems, createItem } = require('../services/inventory.service');

async function getInventory(_req, res) {
  const items = await listItems();
  res.json(items);
}

async function postInventory(req, res) {
  const { name, quantity } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Le champ "name" est requis.' });
  }
  const item = await createItem(name, quantity ?? 1);
  res.status(201).json(item);
}

module.exports = { getInventory, postInventory };

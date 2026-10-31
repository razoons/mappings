const db = require('../db');

const COLLECTION = 'inventory';

async function listItems() {
  const snapshot = await db.collection(COLLECTION).orderBy('createdAt', 'desc').get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

async function createItem(name, quantity = 1) {
  const docRef = await db.collection(COLLECTION).add({
    name,
    quantity,
    createdAt: new Date(),
  });
  return { id: docRef.id, name, quantity };
}

module.exports = { listItems, createItem };

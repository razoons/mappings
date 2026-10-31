const { Router } = require('express');
const { getInventory, postInventory } = require('../controllers/inventory.controller');

const router = Router();

router.get('/', getInventory);
router.post('/', postInventory);

module.exports = router;

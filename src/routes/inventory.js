import express from 'express';
import auth from '../middlewares/auth.js';
import { validateTransaction, validateGetHistory } from '../utils/validator.js';
import { createTransaction, getHistory, getSnapshot } from '../controllers/inventoryController.js';

const router = express.Router();

// POST /transaction
// Authenticated route to create a new inventory transaction
router.post(
	'/transaction',
	auth,
	validateTransaction,
	createTransaction
);

// GET /history/:sku
// Authenticated route to get transaction history for a SKU
router.get(
	'/history/:sku',
	auth,
	validateGetHistory,
	getHistory
);

// GET /snapshot
// Authenticated route to get a snapshot of all products and their stock
router.get(
	'/snapshot',
	auth,
	getSnapshot
);

export default router;